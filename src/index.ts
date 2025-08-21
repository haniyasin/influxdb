import { PaginationOptions } from '@feathersjs/adapter-commons'
import { MethodNotAllowed } from '@feathersjs/errors/lib'
import { Paginated, Params } from '@feathersjs/feathers'
import { AdapterId, InfluxDbAdapter, InfluxDBAdapterParams, NullableAdapterId } from './adapter'

export * from './adapter'
export * from './error-handler'

export class InfluxDBService<
  Result = any,
  Data = Partial<Result>,
  ServiceParams extends Params<any> = InfluxDBAdapterParams,
  PatchData = Partial<Data>
> extends InfluxDbAdapter<Result, Data, ServiceParams, PatchData> {
  async find(params?: ServiceParams & { paginate?: PaginationOptions }): Promise<Paginated<Result>>
  async find(params?: ServiceParams & { paginate: false }): Promise<Result[]>
  async find(params?: ServiceParams): Promise<Paginated<Result> | Result[]>
  async find(params?: ServiceParams): Promise<Paginated<Result> | Result[]> {
    return this._find({
      ...params,
      query: await this.sanitizeQuery(params)
    } as ServiceParams)
  }

  async get(id: AdapterId, params?: ServiceParams): Promise<Result> {
    return this._get(id, {
      ...params,
      query: await this.sanitizeQuery(params)
    } as ServiceParams)
  }

  async create(data: Data, params?: ServiceParams): Promise<Result>
  async create(data: Data[], params?: ServiceParams): Promise<Result[]>
  async create(data: Data | Data[], params?: ServiceParams): Promise<Result | Result[]>
  async create(data: Data | Data[], params?: ServiceParams): Promise<Result | Result[]> {
    if (Array.isArray(data) && !this.allowsMulti('create', params)) {
      throw new MethodNotAllowed('Can not create multiple entries')
    }

    return this._create(data, params)
  }

  async update(id: NullableAdapterId, data: Data, params?: ServiceParams): Promise<Result>
  async update(id: AdapterId, data: Data, params?: ServiceParams): Promise<Result> {
    throw new MethodNotAllowed('InfluxDB does not support updating existing records. Use create to write new data points.')
  }

  async patch(id: null, data: PatchData, params?: ServiceParams): Promise<Result[]>
  async patch(id: AdapterId, data: PatchData, params?: ServiceParams): Promise<Result>
  async patch(id: NullableAdapterId, data: PatchData, params?: ServiceParams): Promise<Result | Result[]>
  async patch(id: NullableAdapterId, data: PatchData, params?: ServiceParams): Promise<Result | Result[]> {
    throw new MethodNotAllowed('InfluxDB does not support patching existing records. Use create to write new data points.')
  }

  async remove(id: AdapterId, params?: ServiceParams): Promise<Result>
  async remove(id: null, params?: ServiceParams): Promise<Result[]>
  async remove(id: NullableAdapterId, params?: ServiceParams): Promise<Result | Result[]>
  async remove(id: NullableAdapterId, params?: ServiceParams): Promise<Result | Result[]> {
    throw new MethodNotAllowed('InfluxDB does not support deleting individual records. Use retention policies or drop measurements instead.')
  }
}