# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-21

### Added
- Initial release of FeathersJS InfluxDB adapter
- Support for InfluxDB 2.x with Flux query language
- Time-series data writing with automatic timestamp handling
- Configurable tag and field mappings
- Query building with filtering, sorting, and pagination
- Organization and bucket management
- Token-based authentication support
- Comprehensive error handling
- TypeScript support with full type definitions
- Complete test suite with 14 passing tests

### Features
- **Data Writing**: Create single or multiple time-series data points
- **Query Building**: Automatic Flux query generation with filters
- **Time Range Support**: Configurable time ranges for data retrieval
- **Field Mapping**: Separate tag and field configurations
- **Pagination**: Built-in support for skip and limit operations
- **Sorting**: Time-based and field-based sorting capabilities
- **Error Handling**: Proper InfluxDB error handling and reporting

### Technical Details
- Compatible with InfluxDB 2.x
- Uses `@influxdata/influxdb-client` v1.33.2
- Supports Node.js 16+ and TypeScript 4+
- Follows FeathersJS service adapter patterns
- Includes comprehensive documentation and examples

### Notes
- Update and patch operations are not supported (InfluxDB limitation)
- Delete operations are not supported (InfluxDB limitation)
- Requires InfluxDB 2.x server instance
- Peer dependency: `@influxdata/influxdb-client`

[1.0.0]: https://github.com/feathersjs/feathers/releases/tag/@feathersjs/influxdb@1.0.0