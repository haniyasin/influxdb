import {
  InfluxDB,
  QueryApi,
  WriteApi,
  Point,
  flux,
  fluxDuration,
  fluxExpression
} from '@influxdata/influxdb-client'
import { BadRequest, MethodNotAllowed, NotFound } from '@feathersjs/errors'
import { _ } from '@feathersjs/commons'
import {
  AdapterBase,
  AdapterParams,
  AdapterServiceOptions,
  PaginationOptions,
  AdapterQuery,
  getLimit
} from '@feathersjs/adapter-commons'
import { Id, Paginated } from '@feathersjs/feathers'
import { errorHandler } from './error-handler'

export interface InfluxDBAdapterOptions extends AdapterServiceOptions {
  client: InfluxDB | Promise<InfluxDB>
  org: string
  bucket: string
  measurement: string
  timeField?: string
  tagFields?: string[]
  fieldFields?: string[]
}

export interface InfluxDBAdapterParams<Q = AdapterQuery>
  extends AdapterParams<Q, Partial<InfluxDBAdapterOptions>> {
  flux?: string
  timeRange?: {
    start?: string | Date
    stop?: string | Date
  }
}

export type AdapterId = Id
export type NullableAdapterId = AdapterId | null

// Create the service.
export class InfluxDbAdapter<
  Result,
  Data = Partial<Result>,
  ServiceParams extends InfluxDBAdapterParams<any> = InfluxDBAdapterParams,
  PatchData = Partial<Data>
> extends AdapterBase<Result, Data, PatchData, ServiceParams, InfluxDBAdapterOptions, AdapterId> {
  constructor(options: InfluxDBAdapterOptions) {
    if (!options) {
      throw new Error('InfluxDB options have to be provided')
    }

    if (!options.client) {
      throw new Error('InfluxDB client must be provided')
    }

    if (!options.org) {
      throw new Error('InfluxDB organization must be provided')
    }

    if (!options.bucket) {
      throw new Error('InfluxDB bucket must be provided')
    }

    if (!options.measurement) {
      throw new Error('InfluxDB measurement must be provided')
    }

    super({
      id: '_time',
      ...options
    })
  }

  filterQuery(id: NullableAdapterId, params: ServiceParams) {
    const options = this.getOptions(params)
    const { $select, $sort, $limit: _limit, $skip = 0, ...query } = (params.query || {}) as AdapterQuery
    const $limit = getLimit(_limit, options.paginate)
    
    if (id !== null) {
      query.$and = (query.$and || []).concat({
        [this.id]: id
      })
    }

    return {
      filters: { $select, $sort, $limit, $skip },
      query
    }
  }

  async getClient(params: ServiceParams = {} as ServiceParams) {
    const { client } = this.getOptions(params)
    return Promise.resolve(client)
  }

  async getQueryApi(params: ServiceParams = {} as ServiceParams) {
    const client = await this.getClient(params)
    const { org } = this.getOptions(params)
    return client.getQueryApi(org)
  }

  async getWriteApi(params: ServiceParams = {} as ServiceParams) {
    const client = await this.getClient(params)
    const { org, bucket } = this.getOptions(params)
    return client.getWriteApi(org, bucket)
  }

  buildFluxQuery(params: ServiceParams) {
    const { filters, query } = this.filterQuery(null, params)
    const { bucket, measurement, timeField = '_time' } = this.getOptions(params)
    const timeRange = params.timeRange || {}
    
    let fluxQuery = `from(bucket: "${bucket}")`
    
    // Add time range filter
    if (timeRange.start || timeRange.stop) {
      const start = timeRange.start ? 
        (timeRange.start instanceof Date ? timeRange.start.toISOString() : timeRange.start) : 
        '-1h'
      const stop = timeRange.stop ? 
        (timeRange.stop instanceof Date ? timeRange.stop.toISOString() : timeRange.stop) : 
        'now()'
      fluxQuery += `\n  |> range(start: ${start}, stop: ${stop})`
    } else {
      fluxQuery += `\n  |> range(start: -1h)`
    }
    
    // Filter by measurement
    fluxQuery += `\n  |> filter(fn: (r) => r._measurement == "${measurement}")`
    
    // Add field filters from query with proper FeathersJS query syntax support
    fluxQuery = this.buildQueryFilters(fluxQuery, query)
    
    // Add sorting
    if (filters.$sort) {
      const sortKeys = Object.keys(filters.$sort)
      sortKeys.forEach(key => {
        const direction = filters.$sort![key] === 1 ? 'true' : 'false'
        fluxQuery += `\n  |> sort(columns: ["${key}"], desc: ${direction === 'false'})`
      })
    }
    
    // Add pagination
    if (filters.$skip && filters.$skip > 0) {
      fluxQuery += `\n  |> drop(n: ${filters.$skip})`
    }
    
    if (filters.$limit && filters.$limit > 0) {
      fluxQuery += `\n  |> limit(n: ${filters.$limit})`
    }
    
    // Add field selection
    if (filters.$select && filters.$select.length > 0) {
      const columns = filters.$select.map(field => `"${field}"`).join(', ')
      fluxQuery += `\n  |> keep(columns: [${columns}])`
    }
    
    return fluxQuery
  }

  buildQueryFilters(fluxQuery: string, query: any): string {
    let result = fluxQuery
    Object.keys(query).forEach(key => {
      if (key.startsWith('$')) {
        // Handle special query operators
        result = this.handleQueryOperator(result, key, query[key])
      } else if (query[key] !== undefined && query[key] !== null) {
        // Handle regular field queries
        result = this.handleFieldQuery(result, key, query[key])
      }
    })
    return result
  }

  handleQueryOperator(fluxQuery: string, operator: string, value: any): string {
    let result = fluxQuery
    switch (operator) {
      case '$and':
        if (Array.isArray(value)) {
          value.forEach(condition => {
            result = this.buildQueryFilters(result, condition)
          })
        }
        break
      case '$or':
        if (Array.isArray(value)) {
          const orConditions = value.map(condition => {
            let conditionQuery = this.buildQueryFilters('', condition)
            return conditionQuery.replace(/^\s*\|>\s*/g, '')
          }).filter(Boolean)
          
          if (orConditions.length > 0) {
            result += `\n  |> filter(fn: (r) => ${orConditions.join(' or ')})`
          }
        }
        break
      // Add support for other operators as needed
    }
    return result
  }

  handleFieldQuery(fluxQuery: string, field: string, value: any): string {
    let result = fluxQuery
    if (typeof value === 'object' && value !== null) {
      // Handle query operators like $in, $nin, $ne, $lt, $lte, $gt, $gte
      Object.keys(value).forEach(operator => {
        const opValue = value[operator]
        switch (operator) {
          case '$eq':
            result += `\n  |> filter(fn: (r) => r.${field} == ${this.formatValue(opValue)})`
            break
          case '$ne':
            result += `\n  |> filter(fn: (r) => r.${field} != ${this.formatValue(opValue)})`
            break
          case '$in':
            if (Array.isArray(opValue)) {
              const values = opValue.map(v => this.formatValue(v)).join(', ')
              result += `\n  |> filter(fn: (r) => r.${field} in [${values}])`
            }
            break
          case '$nin':
            if (Array.isArray(opValue)) {
              const values = opValue.map(v => this.formatValue(v)).join(', ')
              result += `\n  |> filter(fn: (r) => r.${field} not in [${values}])`
            }
            break
          case '$lt':
            result += `\n  |> filter(fn: (r) => r.${field} < ${this.formatValue(opValue)})`
            break
          case '$lte':
            result += `\n  |> filter(fn: (r) => r.${field} <= ${this.formatValue(opValue)})`
            break
          case '$gt':
            result += `\n  |> filter(fn: (r) => r.${field} > ${this.formatValue(opValue)})`
            break
          case '$gte':
            result += `\n  |> filter(fn: (r) => r.${field} >= ${this.formatValue(opValue)})`
            break
        }
      })
    } else {
      // Simple equality filter
      result += `\n  |> filter(fn: (r) => r.${field} == ${this.formatValue(value)})`
    }
    return result
  }

  formatValue(value: any): string {
    if (typeof value === 'string') {
      return `"${value}"`
    } else if (typeof value === 'number') {
      return value.toString()
    } else if (typeof value === 'boolean') {
      return value ? 'true' : 'false'
    } else if (value instanceof Date) {
      return `"${value.toISOString()}"`
    } else {
      return `"${String(value)}"`
    }
  }

  async queryRaw(params: ServiceParams) {
    const queryApi = await this.getQueryApi(params)
    const fluxQuery = params.flux || this.buildFluxQuery(params)
    
    return new Promise<Result[]>((resolve, reject) => {
      const results: Result[] = []
      
      queryApi.queryRows(fluxQuery, {
        next: (row, tableMeta) => {
          const record = tableMeta.toObject(row) as Result
          results.push(record)
        },
        error: (error) => {
          reject(errorHandler(error))
        },
        complete: () => {
          resolve(results)
        }
      })
    })
  }

  async countDocuments(params: ServiceParams) {
    const { bucket, measurement } = this.getOptions(params)
    const timeRange = params.timeRange || {}
    
    let countQuery = `from(bucket: "${bucket}")`
    
    if (timeRange.start || timeRange.stop) {
      const start = timeRange.start ? 
        (timeRange.start instanceof Date ? timeRange.start.toISOString() : timeRange.start) : 
        '-1h'
      const stop = timeRange.stop ? 
        (timeRange.stop instanceof Date ? timeRange.stop.toISOString() : timeRange.stop) : 
        'now()'
      countQuery += `\n  |> range(start: ${start}, stop: ${stop})`
    } else {
      countQuery += `\n  |> range(start: -1h)`
    }
    
    countQuery += `\n  |> filter(fn: (r) => r._measurement == "${measurement}")`
    countQuery += `\n  |> count()`
    
    const queryApi = await this.getQueryApi(params)
    
    return new Promise<number>((resolve, reject) => {
      let count = 0
      
      queryApi.queryRows(countQuery, {
        next: (row, tableMeta) => {
          const record = tableMeta.toObject(row)
          count = record._value || 0
        },
        error: (error) => {
          reject(errorHandler(error))
        },
        complete: () => {
          resolve(count)
        }
      })
    })
  }

  async _get(id: AdapterId, params: ServiceParams = {} as ServiceParams): Promise<Result> {
    const queryParams = {
      ...params,
      query: {
        ...params.query,
        [this.id]: id,
        $limit: 1
      }
    }
    
    const results = await this.queryRaw(queryParams)
    
    if (!results || results.length === 0) {
      throw new NotFound(`No record found for id '${id}'`)
    }
    
    return results[0]
  }

  async _find(params?: ServiceParams & { paginate?: PaginationOptions }): Promise<Paginated<Result>>
  async _find(params?: ServiceParams & { paginate: false }): Promise<Result[]>
  async _find(params?: ServiceParams): Promise<Paginated<Result> | Result[]>
  async _find(params: ServiceParams = {} as ServiceParams): Promise<Paginated<Result> | Result[]> {
    const { paginate } = this.getOptions(params)
    const { filters } = this.filterQuery(null, params)
    const paginationDisabled = params.paginate === false || !paginate || !paginate.default

    const getData = () => this.queryRaw(params)

    if (paginationDisabled) {
      if (filters.$limit === 0) {
        return [] as Result[]
      }
      const data = await getData()
      return data as Result[]
    }

    if (filters.$limit === 0) {
      return {
        total: await this.countDocuments(params),
        limit: filters.$limit,
        skip: filters.$skip || 0,
        data: [] as Result[]
      }
    }

    const [data, total] = await Promise.all([getData(), this.countDocuments(params)])

    return {
      total,
      limit: filters.$limit,
      skip: filters.$skip || 0,
      data: data as Result[]
    }
  }

  async _create(data: Data, params?: ServiceParams): Promise<Result>
  async _create(data: Data[], params?: ServiceParams): Promise<Result[]>
  async _create(data: Data | Data[], _params?: ServiceParams): Promise<Result | Result[]>
  async _create(
    data: Data | Data[],
    params: ServiceParams = {} as ServiceParams
  ): Promise<Result | Result[]> {
    if (Array.isArray(data) && !this.allowsMulti('create', params)) {
      throw new MethodNotAllowed('Can not create multiple entries')
    }

    const writeApi = await this.getWriteApi(params)
    const { measurement, tagFields = [], fieldFields = [] } = this.getOptions(params)

    const createPoint = (item: any) => {
      const point = new Point(measurement)
      
      // Set timestamp
      if (item._time) {
        point.timestamp(new Date(item._time))
      }
      
      // Set tags
      tagFields.forEach(tag => {
        if (item[tag] !== undefined) {
          point.tag(tag, String(item[tag]))
        }
      })
      
      // Set fields
      fieldFields.forEach(field => {
        if (item[field] !== undefined) {
          const value = item[field]
          if (typeof value === 'number') {
            point.floatField(field, value)
          } else if (typeof value === 'boolean') {
            point.booleanField(field, value)
          } else {
            point.stringField(field, String(value))
          }
        }
      })
      
      // Set remaining fields that aren't tags or special fields
      Object.keys(item).forEach(key => {
        if (!tagFields.includes(key) && !fieldFields.includes(key) && key !== '_time' && key !== '_measurement') {
          const value = item[key]
          if (typeof value === 'number') {
            point.floatField(key, value)
          } else if (typeof value === 'boolean') {
            point.booleanField(key, value)
          } else {
            point.stringField(key, String(value))
          }
        }
      })
      
      return point
    }

    try {
      if (Array.isArray(data)) {
        const points = data.map(createPoint)
        writeApi.writePoints(points)
        await writeApi.close()
        
        // Return the created data (InfluxDB doesn't return inserted data like MongoDB)
        return data.map(item => ({ ...item, _time: (item as any)._time || new Date().toISOString() })) as Result[]
      }

      const point = createPoint(data)
      writeApi.writePoint(point)
      await writeApi.close()
      
      // Return the created data with timestamp
      return { ...data, _time: (data as any)._time || new Date().toISOString() } as Result
    } catch (error) {
      throw errorHandler(error)
    }
  }

  async _patch(id: null, data: PatchData, params?: ServiceParams): Promise<Result[]>
  async _patch(id: Id, data: PatchData, params?: ServiceParams): Promise<Result>
  async _patch(id: Id, data: PatchData[], params?: ServiceParams): Promise<Result[]>
  async _patch(
    id: NullableAdapterId,
    data: PatchData | PatchData[],
    params: ServiceParams = {} as ServiceParams
  ): Promise<Result | Result[]> {
    throw new MethodNotAllowed('InfluxDB does not support updating existing records. Use _create to write new data points.')
  }

  async _update(
    id: AdapterId,
    data: Data,
    params: ServiceParams = {} as ServiceParams
  ): Promise<Result> {
    throw new MethodNotAllowed('InfluxDB does not support updating existing records. Use _create to write new data points.')
  }

  async _remove(id: null, params?: ServiceParams): Promise<Result[]>
  async _remove(id: AdapterId, params?: ServiceParams): Promise<Result>
  async _remove(id: NullableAdapterId, _params?: ServiceParams): Promise<Result | Result[]>
  async _remove(
    id: NullableAdapterId,
    params: ServiceParams = {} as ServiceParams
  ): Promise<Result | Result[]> {
    throw new MethodNotAllowed('InfluxDB does not support deleting individual records. Use retention policies or drop measurements instead.')
  }
}