## Purpose

Collect the lowest fares from Taipei airports (TPE and TSA) to a curated list of popular destinations over the next 12 months, publish them as a daily cache, and retain price history for later comparison.

## ADDED Requirements

### Requirement: Daily fare snapshot

The system SHALL run a daily job that queries the configured price source for every combination of origin airport (TPE, TSA) and configured destination, and writes the result to a snapshot file consumed by the front end.

#### Scenario: Successful daily run

- **WHEN** the daily job runs and the price source answers for all configured routes
- **THEN** the snapshot file contains, for each origin and destination, the lowest fare per calendar month for the next 12 months
- **AND** the snapshot records the generation time and the price source name

#### Scenario: Partial failure keeps previous data

- **WHEN** the price source fails for some routes during a run
- **THEN** the snapshot keeps the previous successful entries for those routes
- **AND** each kept entry is marked stale with the time of its last successful update

### Requirement: Configurable destination list

The system SHALL read the destination list from a configuration file and SHALL NOT query destinations outside that list.

#### Scenario: Destination added by configuration

- **WHEN** an operator adds an airport code to the destination configuration and the job runs
- **THEN** the next snapshot includes fares for that destination from both TPE and TSA

#### Scenario: Invalid destination code

- **WHEN** the configuration contains a code that is not a three-letter airport code
- **THEN** the job fails before querying the price source and reports the invalid entry

### Requirement: Fare record shape

Each fare record SHALL state origin, destination, travel month, price amount, currency, trip type (one-way or round-trip), whether taxes are included, and a booking link.

#### Scenario: Trip type is never omitted

- **WHEN** a fare record is written
- **THEN** the trip type field is present with the value one-way or round-trip

### Requirement: Price history retention

The system SHALL append each day's lowest fare per route and month to a history store and SHALL keep at least 90 days of history.

#### Scenario: History grows daily

- **WHEN** the daily job completes on two consecutive days
- **THEN** the history store contains one entry per route and month for each of those days

##### Example: history window

| Days of history available | Result |
| ------------------------- | ------ |
| 0 to 89 | route is marked history-insufficient |
| 90 or more | route is marked history-sufficient |

### Requirement: Secrets stay out of published output

The system SHALL read price source credentials from environment variables and SHALL NOT write them to any snapshot, history, or front-end file.

#### Scenario: Credentials absent

- **WHEN** the required credential environment variable is not set
- **THEN** the job exits with a non-zero status and a message naming the missing variable
