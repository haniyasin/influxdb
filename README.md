# feathersjs-influxdb

A [Feathers](https://feathersjs.com) service adapter for [InfluxDB](https://www.influxdata.com/), a time-series database.

## Installation

```bash
npm install feathersjs-influxdb @influxdata/influxdb-client
```

## Usage

### Basic Setup

```javascript
import { InfluxDB } from '@influxdata/influxdb-client'
import { InfluxDBService } from 'feathersjs-influxdb'

// Create InfluxDB client
const client = new InfluxDB({
  url: 'http://localhost:8086',
  token: 'your-influxdb-token'
})

// Create service
const service = new InfluxDBService({
  client,
  org: 'your-org',
  bucket: 'your-bucket',
  measurement: 'sensor_data',
  tagFields: ['device_id', 'location'],
  fieldFields: ['temperature', 'humidity', 'pressure']
})

// Use with Feathers app
app.use('sensor-data', service)
```

### Configuration Options

- `client` (**required**): InfluxDB client instance
- `org` (**required**): InfluxDB organization
- `bucket` (**required**): InfluxDB bucket name
- `measurement` (**required**): InfluxDB measurement name
- `tagFields` (optional): Array of field names to be treated as tags
- `fieldFields` (optional): Array of field names to be treated as fields
- `timeField` (optional): Name of the time field (defaults to '_time')

### Querying Data

#### Basic Find

```javascript
// Find all records from the last hour (default)
const results = await app.service('sensor-data').find()

// Find with custom time range
const results = await app.service('sensor-data').find({
  timeRange: {
    start: '2023-01-01T00:00:00Z',
    stop: '2023-01-02T00:00:00Z'
  }
})
```

#### Filtering

```javascript
// Filter by tag or field values
const results = await app.service('sensor-data').find({
  query: {
    device_id: 'sensor001',
    location: 'room1'
  }
})

// Advanced filtering with operators
const results = await app.service('sensor-data').find({
  query: {
    $or: [
      { device_id: 'sensor001' },
      { device_id: 'sensor002' }
    ],
    temperature: { $gt: 20, $lt: 30 },
    status: { $ne: 'offline' },
    location: { $in: ['room1', 'room2'] }
  }
})
```

#### Sorting

```javascript
// Sort by time (descending)
const results = await app.service('sensor-data').find({
  query: {
    $sort: { _time: -1 }
  }
})
```

#### Pagination

```javascript
// Paginated results
const results = await app.service('sensor-data').find({
  query: {
    $limit: 100,
    $skip: 50
  }
})
```

#### Custom Flux Queries

```javascript
// Use custom Flux query
const results = await app.service('sensor-data').find({
  flux: `
    from(bucket: "your-bucket")
      |> range(start: -1h)
      |> filter(fn: (r) => r._measurement == "sensor_data")
      |> filter(fn: (r) => r.device_id == "sensor001")
      |> aggregateWindow(every: 5m, fn: mean)
  `
})
```

### Writing Data

#### Create Single Record

```javascript
const result = await app.service('sensor-data').create({
  device_id: 'sensor001',
  location: 'room1',
  temperature: 23.5,
  humidity: 45.2,
  _time: new Date() // Optional, defaults to current time
})
```

#### Create Multiple Records

```javascript
const results = await app.service('sensor-data').create([
  {
    device_id: 'sensor001',
    temperature: 23.5,
    humidity: 45.2
  },
  {
    device_id: 'sensor002',
    temperature: 24.1,
    humidity: 43.8
  }
])
```

### Supported Query Operators

The adapter supports all standard FeathersJS query operators:

- **Comparison**: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`
- **Logical**: `$and`, `$or`, `$nor`, `$not`
- **Array**: `$in`, `$nin`
- **Pagination**: `$limit`, `$skip`
- **Sorting**: `$sort`

### Limitations

Due to InfluxDB's time-series nature, certain operations are not supported:

- **Update**: InfluxDB doesn't support updating existing records. Use `create` to write new data points.
- **Patch**: InfluxDB doesn't support patching existing records. Use `create` to write new data points.
- **Remove**: InfluxDB doesn't support deleting individual records. Use retention policies or drop measurements instead.

### Data Types

InfluxDB supports the following field data types:
- **Float**: Numbers (default for numeric values)
- **Integer**: Whole numbers
- **String**: Text values
- **Boolean**: true/false values

Tags are always stored as strings in InfluxDB.

### Time Handling

The adapter uses `_time` as the default time field. You can:
- Provide a custom timestamp when creating records
- Let InfluxDB use the current server time (default)
- Query data within specific time ranges using the `timeRange` parameter

### Error Handling

The adapter includes error handling for common InfluxDB errors and converts them to appropriate Feathers errors.

### Response Format

The adapter returns data in standard FeathersJS format:

```javascript
// For find() with pagination
{
  total: 100,     // Total number of records
  limit: 10,      // Maximum records per page
  skip: 20,       // Number of records skipped
  data: [...]     // Array of result objects
}

// For find() without pagination
[/* array of result objects */]

// For create()
{/* created object with _time field */}
```

### API Reference

| Method | Description | Returns |
|--------|-------------|---------|
| `find(params)` | Query time-series data | `Paginated<Result>` or `Result[]` |
| `create(data)` | Write data points | `Result` or `Result[]` |
| `update(id, data)` | ❌ Not supported (throws error) | - |
| `patch(id, data)` | ❌ Not supported (throws error) | - |
| `remove(id)` | ❌ Not supported (throws error) | - |

### Best Practices

1. **Use tags for high-cardinality data**: Device IDs, locations, etc.
2. **Use fields for numeric measurements**: Temperature, humidity, etc.
3. **Batch writes**: Use array `create()` for better performance
4. **Set appropriate retention policies**: Manage data lifecycle in InfluxDB
5. **Use time ranges**: Always specify time ranges for queries when possible

## License

MIT