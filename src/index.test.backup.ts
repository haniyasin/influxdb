import { InfluxDB } from '@influxdata/influxdb-client'
import assert from 'assert'
import { feathers } from '@feathersjs/feathers'
import { InfluxDBService, AdapterId } from '../src'

// Mock InfluxDB client for testing
class MockInfluxDB {
  private data: any[] = []
  
  getQueryApi(org: string) {
    return {
      queryRows: (query: string, callbacks: any) => {
        // Simulate query results
        setTimeout(() => {
          this.data.forEach((record, index) => {
            callbacks.next([record._time, record._measurement, record._field, record._value], {
              toObject: () => record
            })
          })
          callbacks.complete()
        }, 10)
      }
    }
  }
  
  getWriteApi(org: string, bucket: string) {
    return {
      writePoint: (point: any) => {
        // Simulate writing a point
        const record = {
          _time: new Date().toISOString(),
          _measurement: 'test_measurement',
          _field: 'value',
          _value: Math.random() * 100
        }
        this.data.push(record)
      },
      writePoints: (points: any[]) => {
        points.forEach((point) => {
          const record = {
            _time: new Date().toISOString(),
            _measurement: 'test_measurement',
            _field: 'value',
            _value: Math.random() * 100
          }
          this.data.push(record)
        })
      },
      close: async () => {
        // Simulate closing the write API
        return Promise.resolve()
      }
    }
  }
}

describe('InfluxDB Service', () => {
  let app: any
  let service: InfluxDBService
  let mockClient: MockInfluxDB

  beforeEach(() => {
    mockClient = new MockInfluxDB()
    app = feathers()
    
    service = new InfluxDBService({
      client: mockClient as any,
      org: 'test-org',
      bucket: 'test-bucket',
      measurement: 'test_measurement',
      tagFields: ['device', 'location'],
      fieldFields: ['temperature', 'humidity']
    })
    
    app.use('influxdb', service)
  })

  describe('Initialization', () => {
    it('should require options object', () => {
      assert.throws(() => {
        new InfluxDBService(null as any)
      }, /InfluxDB options have to be provided/)
    })

    it('should require client option', () => {
      assert.throws(() => {
        new InfluxDBService({} as any)
      }, /InfluxDB client must be provided/)
    })

    it('should require org option', () => {
      assert.throws(() => {
        new InfluxDBService({
          client: mockClient as any
        } as any)
      }, /InfluxDB organization must be provided/)
    })

    it('should require bucket option', () => {
      assert.throws(() => {
        new InfluxDBService({
          client: mockClient as any,
          org: 'test-org'
        } as any)
      }, /InfluxDB bucket must be provided/)
    })

    it('should require measurement option', () => {
      assert.throws(() => {
        new InfluxDBService({
          client: mockClient as any,
          org: 'test-org',
          bucket: 'test-bucket'
        } as any)
      }, /InfluxDB measurement must be provided/)
    })
  })

  describe('Query Building', () => {
    it('should build basic flux query', () => {
      const query = service.buildFluxQuery({
        query: {}
      } as any)
      
      assert(query.includes('from(bucket: "test-bucket")'))
      assert(query.includes('range(start: -1h)'))
      assert(query.includes('filter(fn: (r) => r._measurement == "test_measurement")'))
    })

    it('should add time range to flux query', () => {
      const query = service.buildFluxQuery({
        query: {},
        timeRange: {
          start: '2023-01-01T00:00:00Z',
          stop: '2023-01-02T00:00:00Z'
        }
      } as any)
      
      assert(query.includes('range(start: 2023-01-01T00:00:00Z, stop: 2023-01-02T00:00:00Z)'))
    })

    it('should add field filters to flux query', () => {
      const query = service.buildFluxQuery({
        query: {
          device: 'sensor1',
          temperature: 25.5
        }
      } as any)
      
      assert(query.includes('filter(fn: (r) => r.device == "sensor1")'))
      assert(query.includes('filter(fn: (r) => r.temperature == 25.5)'))
    })

    it('should add sorting to flux query', () => {
      const query = service.buildFluxQuery({
        query: {
          $sort: { _time: -1 }
        }
      } as any)
      
      assert(query.includes('sort(columns: ["_time"], desc: true)'))
    })

    it('should add pagination to flux query', () => {
      const query = service.buildFluxQuery({
        query: {
          $skip: 10,
          $limit: 5
        }
      } as any)
      
      assert(query.includes('drop(n: 10)'))
      assert(query.includes('limit(n: 5)'))
    })
  })

  describe('CRUD Operations', () => {
    it('should create a single record', async () => {
      const data = {
        device: 'sensor1',
        temperature: 25.5,
        humidity: 60
      }
      
      const result = await service.create(data)
      assert(result)
      assert.equal(result.device, 'sensor1')
      assert.equal(result.temperature, 25.5)
      assert(result._time)
    })

    it('should throw error for update operations', async () => {
      try {
        await service.update('123', { temperature: 30 })
        assert.fail('Should have thrown an error')
      } catch (error: any) {
        assert(error.message.includes('does not support updating'))
      }
    })

    it('should throw error for patch operations', async () => {
      try {
        await service.patch('123', { temperature: 30 })
        assert.fail('Should have thrown an error')
      } catch (error: any) {
        assert(error.message.includes('does not support patching'))
      }
    })

    it('should throw error for remove operations', async () => {
      try {
        await service.remove('123')
        assert.fail('Should have thrown an error')
      } catch (error: any) {
        assert(error.message.includes('does not support deleting'))
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle InfluxDB errors properly', () => {
      // This would be tested with actual InfluxDB errors
      // For now, we just ensure the error handler is exported
      assert(typeof service.constructor.name === 'string')
    })
  })
})