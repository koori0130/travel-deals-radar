## Purpose

Collect promotional fares published by airlines for departures from Taipei, normalize them into one record shape, and surface source freshness so the one-month deals view can rely on airline promotions.

## ADDED Requirements

### Requirement: Normalized promo record

The system SHALL convert each airline promotion into a record with airline, origin airport, destination, price amount, currency, trip type (one-way or round-trip), taxes-included flag, travel date range, sale start time, sale end time, source page URL, and fetch time.

#### Scenario: Missing end time

- **WHEN** a promotion page does not state a sale end time
- **THEN** the record stores the end time as unknown
- **AND** the record is never given an invented end time

### Requirement: First-batch airline coverage

The system SHALL provide a source for each of these airlines: Tigerair Taiwan, Peach, Scoot, Jetstar, and AirAsia.

#### Scenario: Each airline has a source

- **WHEN** an operator lists the configured promo sources
- **THEN** the list contains one source for each of the five airlines
- **AND** each source shows its acquisition method (official feed, page fetch, or manual entry)

### Requirement: Terms check before automated fetching

The system SHALL fetch an airline page automatically only when the source configuration records that the airline's terms were reviewed and allow it; otherwise the source SHALL use official feeds or manual entry.

#### Scenario: Terms not reviewed

- **WHEN** a source is configured for page fetching without a recorded terms review
- **THEN** the system refuses to run the automated fetch for that source and reports the reason

### Requirement: Manual promo entry

The system SHALL accept a manually entered promotion with the same fields as a normalized promo record and SHALL mark it as manual in the output.

#### Scenario: Manual entry appears in output

- **WHEN** an operator adds a manual promotion with a sale end time in the future
- **THEN** the next promo output contains that record marked as manual

### Requirement: Expired promo removal

The system SHALL exclude promotions whose sale end time has passed from the active promo output.

#### Scenario: Promotion expires

- **WHEN** the current time is after a record's sale end time
- **THEN** the record is absent from the active promo output

### Requirement: Stale source warning

The system SHALL flag a source as stale when it has not produced a successful update within the configured number of days, and SHALL include that flag in the promo output.

#### Scenario: Source goes stale

- **WHEN** a source's last successful update is older than the configured threshold
- **THEN** the promo output marks that source stale with its last update time

##### Example: threshold of 3 days

| Last successful update | Now | Flag |
| ---------------------- | --- | ---- |
| 2 days ago | today | fresh |
| 4 days ago | today | stale |
