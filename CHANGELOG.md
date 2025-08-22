# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.2] - 2025-08-22

### Fixed
- **Response format**: Corrected paginated response object property order to match FeathersJS standard (total, limit, skip, data)

## [1.1.1] - 2025-08-22

### Fixed
- **Package cleanup**: Removed test files from published package
- **Build configuration**: Updated TypeScript config to exclude test files from compilation
- **File inclusion**: Updated package.json files array to only include production files

## [1.1.0] - 2025-08-22

### Added
- **Comprehensive FeathersJS query support**: Full implementation of FeathersJS common query operators
- **Advanced filtering**: Support for $and, $or, $in, $nin, $ne, $lt, $lte, $gt, $gte operators
- **Enhanced test suite**: Expanded from 14 to 15 passing tests with improved coverage
- **Better error handling**: More specific error messages and validation

### Improved
- **Query building**: More robust Flux query generation with proper operator handling
- **TypeScript support**: Improved type definitions and better integration
- **Test configuration**: Updated to use ts-mocha for direct TypeScript testing
- **Documentation**: Enhanced examples and usage patterns

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

[1.0.0]: https://github.com/feathersjs/feathers/releases/tag/feathersjs-influxdb@1.0.0