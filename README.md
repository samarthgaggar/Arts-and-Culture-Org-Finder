# Arts and Cultures Org Finder

A web-based tool that lets you search for arts, culture, and educational organizations (such as museums, galleries, art centers, botanical gardens,theatres, etc.) near your chosen location. Combines accessibility, performance, and ease of use.

## Features

- **Location Search:** Enter a city or address to find nearby arts and culture organizations.
- **Radius Adjustment:** Specify the search area, from 5 km to 50 km.
- **Contact Filter:** Only displays organizations with a working website or email.
- **Interactive Results:** Sort results by name, type, or contact. Fully keyboard and screen reader accessible.
- **CSV Export:** Download full results for further use.
- **Responsive Design:** Works on both desktop and mobile; supports automatic dark mode.

## Quick Start

- Clone the repository:
  ```bash
  git clone https://github.com/samarthgaggar/ArtPharmacyOrgFinder.git
  cd ArtPharmacyOrgFinder
  ```
- Open `index.html` in your web browser. No setup needed.

## How It Works

- **Geolocation:** Converts the entered location to coordinates using OpenStreetMap Nominatim.
- **Data Query:** Uses Overpass API to locate arts, culture, and educational organizations in the vicinity, filtering by relevant tags.
- **Contact Validation:** Only lists organizations with valid contact info (email or website), after deduplication.
- **Results Display:** Shows all matching organizations in an accessible format, allowing sorting and CSV export.

## Customization

- Modify search filters or add organization types directly in the Overpass API query inside `app.js`.
- Change color themes or layout by editing `style.css`.

## Accessibility

- Semantic HTML with strong color contrast, ARIA labels, and keyboard-friendly navigation.
- All interactive elements are screen reader compatible.

## Troubleshooting

- If you find no results, try searching a larger city or increase the search radius.
- If experience API/network errors, Overpass or Nominatim services may be rate-limited—wait a few minutes, then retry.

## Credits

- Built on [OpenStreetMap](https://www.openstreetmap.org/) data and APIs.
- Created to improve public access to arts and culture programs.
- Contributions and improvements are welcomed via GitHub issues or pull requests.
