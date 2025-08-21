import { GeneralError } from '@feathersjs/errors'
import { HttpError } from '@influxdata/influxdb-client'

export function errorHandler(error: any): any {
  // Handle InfluxDB client errors
  if (error instanceof HttpError) {
    throw new GeneralError(error, {
      name: 'InfluxDBError',
      code: error.statusCode,
      statusCode: error.statusCode
    })
  }

  // Handle other InfluxDB-related errors
  if (error && error.name && (error.name.includes('Influx') || error.name.includes('Flux'))) {
    throw new GeneralError(error, {
      name: error.name,
      code: error.code || 500
    })
  }

  throw error
}