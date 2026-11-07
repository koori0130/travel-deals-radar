## Purpose

Provide the "Travel on a whim" page where visitors see the cheapest fares from Taipei over the next year and the airline promotions released for the next month, with links out to book.

## ADDED Requirements

### Requirement: Year view of cheapest destinations

The page SHALL provide a view that lists destinations ordered by lowest fare over the next 12 months, showing for each destination the lowest price and the month it applies to.

#### Scenario: Default ordering

- **WHEN** a visitor opens the year view
- **THEN** destinations are listed from lowest to highest price
- **AND** each row shows destination, price, currency, trip type, and travel month

##### Example: ordering

- **GIVEN** fares TPE to Tokyo 6200 in March, TPE to Bangkok 4800 in June, TPE to Seoul 5100 in July
- **WHEN** the visitor opens the year view
- **THEN** the order is Bangkok, Seoul, Tokyo

### Requirement: Origin airport selection

The page SHALL let the visitor choose TPE, TSA, or both, and SHALL filter all views accordingly.

#### Scenario: Only TSA selected

- **WHEN** the visitor selects only TSA
- **THEN** no fare or promotion departing from TPE is shown

### Requirement: Month detail for a destination

The page SHALL show, for a selected destination, the lowest fare for each of the next 12 months.

#### Scenario: Open a destination

- **WHEN** the visitor selects a destination in the year view
- **THEN** the page shows 12 months with the lowest fare for each month
- **AND** months without data are shown as no data

### Requirement: Next-month promotions view

The page SHALL provide a view of active airline promotions whose travel dates fall within the next 30 days or whose sale ends within the next 30 days, ordered by price and then by nearest sale end time.

#### Scenario: Promotion shown with its source

- **WHEN** a visitor opens the promotions view
- **THEN** each promotion shows airline, destination, price, trip type, sale end time (or unknown), and a link to the source page

##### Example: tie ordering

- **GIVEN** two promotions both priced 3000, one ending tomorrow and one ending in ten days
- **WHEN** the visitor opens the promotions view
- **THEN** the one ending tomorrow is listed first

### Requirement: Trip types are not mixed in ranking

The page SHALL rank one-way and round-trip fares separately and SHALL label every price with its trip type.

#### Scenario: Mixed data

- **WHEN** the data contains both one-way and round-trip fares
- **THEN** they appear under separate groupings or filters and are not sorted into one price ranking

### Requirement: Freshness and staleness display

The page SHALL display the data generation time and SHALL mark data from stale sources visibly.

#### Scenario: Stale airline source

- **WHEN** an airline source is flagged stale
- **THEN** the promotions view shows a stale notice for that airline with its last update time

### Requirement: Booking handoff only

The page SHALL link out to the airline or booking site for purchase and SHALL NOT collect payment or personal data.

#### Scenario: Visitor clicks a deal

- **WHEN** the visitor selects the booking link of a fare or promotion
- **THEN** the destination site opens in a new tab and this page stores no personal data

### Requirement: Prefilled price-check links

The page SHALL offer, for every fare and every promotion, a Google Flights link and a Skyscanner link that are prefilled with the origin airport, the destination airport, and a departure date, and SHALL open them in a new tab. The page SHALL NOT embed or copy results from those sites.

#### Scenario: Link carries route and date

- **WHEN** the visitor opens the detail of a fare or the card of a promotion
- **THEN** both links are present and each contains the origin, the destination, and the departure date

##### Example: departure date choice

| Promo travel start | Today | Date used in the links |
| ------------------ | ----- | ---------------------- |
| 2026-12-01 | 2026-11-07 | 2026-12-01 |
| 2026-10-01 | 2026-11-07 | 2026-11-08 |
| not announced | 2026-11-07 | 2026-11-08 |

##### Example: link shape

- **GIVEN** origin TPE, destination KIX, date 2026-12-01
- **WHEN** the Skyscanner link is built
- **THEN** its path is /transport/flights/tpe/kix/261201/ on the Taiwan site

### Requirement: Airline front-page links are labeled

When a promotion's link only points to the airline's front page, the page SHALL label that link as the airline's site and SHALL state on the card that it does not carry the route or date.

#### Scenario: Promotion without its own page

- **WHEN** a promotion's source link is the airline's front page
- **THEN** the card labels the link with the airline's name followed by site, and shows a note that the front page does not carry the search conditions

#### Scenario: Promotion with its own page

- **WHEN** a promotion's source link is a page other than the airline's front page
- **THEN** the card labels the link as the promotion page and shows no such note

### Requirement: Airline filter for promotions

The promotions view SHALL let the visitor select one or more airlines, and SHALL show only promotions of the selected airlines. With no airline selected, the view SHALL show all airlines. The year view SHALL NOT offer this filter, because its price source does not report airlines.

#### Scenario: One airline selected

- **WHEN** the visitor selects only Scoot in the promotions view
- **THEN** only Scoot promotions are listed and the selected airline is marked as selected

#### Scenario: No promotion for the selection

- **WHEN** the selected airlines have no active promotion for the chosen origin and trip type
- **THEN** the view shows a message that says so and how to widen the selection

### Requirement: Google Flights explore link

The page SHALL provide a Google Flights explore link for each selected origin airport, so visitors can browse every destination from that airport on Google's own page.

#### Scenario: Both airports selected

- **WHEN** both TPE and TSA are selected
- **THEN** the page shows one explore link for TPE and one for TSA

### Requirement: View state kept in the URL

The page SHALL keep the selected view, origin airports, trip type, and airlines in the URL hash, and SHALL restore them when the page is reloaded or the visitor returns to it with the browser Back button. A missing or damaged hash SHALL fall back to the year view, both airports, and one-way fares with no airline selected.

#### Scenario: Return from an external site

- **WHEN** the visitor selects the promotions view and Scoot, opens an external site, and returns with Back
- **THEN** the promotions view is shown with Scoot still selected

#### Scenario: Damaged hash

- **WHEN** the URL hash contains unknown values
- **THEN** the page shows the year view with both airports and one-way fares

### Requirement: Usable on mobile

The page SHALL be usable on a 375 pixel wide screen without horizontal page scrolling.

#### Scenario: Narrow viewport

- **WHEN** the page is rendered at 375 pixels wide
- **THEN** both views are readable and operable without horizontal page scrolling

### Requirement: Empty and failure states

The page SHALL show a clear message when the data file cannot be loaded or contains no entries.

#### Scenario: Data file missing

- **WHEN** the data file request fails
- **THEN** the page shows a load-failure message and no fare rows
