function updateTableBody(organizations) {
    // Clear current table body
    elements.resultsTbody.innerHTML = '';
    
    // Add each organization to the table
    organizations.forEach(org => {
        const row = document.createElement('tr');
        
        // Name cell
        const nameCell = document.createElement('td');
        nameCell.textContent = org.name;
        row.appendChild(nameCell);
        
        // Website cell
        const websiteCell = document.createElement('td');
        if (org.website) {
            const link = document.createElement('a');
            link.href = org.website.startsWith('http') ? org.website : `https://${org.website}`;
            link.textContent = 'Visit Website';
            link.className = 'table-link';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            websiteCell.appendChild(link);
        } else {
            websiteCell.textContent = '-';
        }
        row.appendChild(websiteCell);
        
        // Contact cell
        const contactCell = document.createElement('td');
        if (org.email) {
            const mailLink = document.createElement('a');
            mailLink.href = `mailto:${org.email}`;
            mailLink.textContent = org.email;
            mailLink.className = 'table-link';
            contactCell.appendChild(mailLink);
        } else if (org.phone) {
            const phoneLink = document.createElement('a');
            phoneLink.href = `tel:${org.phone.replace(/[^\d+]/g, '')}`;
            phoneLink.textContent = org.phone;
            phoneLink.className = 'table-link';
            contactCell.appendChild(phoneLink);
        } else {
            contactCell.textContent = '-';
        }
        row.appendChild(contactCell);
        
        // Type cell
        const typeCell = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = `type-badge ${getBadgeClass(org.type)}`;
        badge.textContent = org.type;
        typeCell.appendChild(badge);
        row.appendChild(typeCell);
        
        elements.resultsTbody.appendChild(row);
    });
    
    // Update the results count
    elements.resultsCount.textContent = `${organizations.length} organization${organizations.length !== 1 ? 's' : ''} found`;
    
    // Store the current sorted results
    currentResults = organizations;
}// Global variables
let currentResults = [];
let currentSortColumn = null;
let currentSortDirection = 'asc';
let elements = {};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Get DOM elements
    elements = {
        locationInput: document.getElementById('location-input'),
        radiusSlider: document.getElementById('radius-slider'),
        radiusDisplay: document.getElementById('radius-display'),
        searchBtn: document.getElementById('search-btn'),
        resultsSection: document.getElementById('results-section'),
        loadingContainer: document.getElementById('loading-container'),
        errorMessage: document.getElementById('error-message'),
        tableContainer: document.getElementById('table-container'),
        resultsTbody: document.getElementById('results-tbody'),
        resultsCount: document.getElementById('results-count'),
        downloadCsvBtn: document.getElementById('download-csv')
    };

    setupEventListeners();
    updateRadiusDisplay();
}

function setupEventListeners() {
    elements.searchBtn?.addEventListener('click', handleSearch);
    elements.locationInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    if (elements.radiusSlider) {
        elements.radiusSlider.addEventListener('input', updateRadiusDisplay);
        elements.radiusSlider.addEventListener('change', updateRadiusDisplay);
    }

    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => handleSort(header.dataset.column));
    });

    elements.downloadCsvBtn?.addEventListener('click', downloadCsv);
}

function updateRadiusDisplay() {
    const slider = elements.radiusSlider;
    const display = elements.radiusDisplay;
    
    if (slider && display) {
        const value = slider.value;
        display.textContent = `${value} km`;
    }
}

async function handleSearch() {
    const location = elements.locationInput?.value?.trim();
    if (!location) {
        showError('Please enter a location to search.');
        return;
    }

    try {
        showLoading('Finding location...');
        hideError();
        
        // Step 1: Geocode the location
        const coords = await geocodeLocation(location);
        console.log('Location found:', coords);
        
        // Step 2: Search for cultural organizations
        updateLoadingMessage('Searching for cultural organizations...');
        const radius = parseInt(elements.radiusSlider?.value || 25) * 1000; // Convert to meters
        const organizations = await searchCulturalOrganizations(coords, radius);
        
        console.log(`Found ${organizations.length} organizations`);
        
        // Step 3: Process and display results
        currentResults = organizations;
        displayResults(currentResults);
        
    } catch (error) {
        console.error('Search error:', error);
        showError(error.message || 'Search failed. Please try again.');
    } finally {
        hideLoading();
    }
}

async function geocodeLocation(location) {
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Geocoding failed');
        
        const data = await response.json();
        if (!data || data.length === 0) {
            throw new Error('Location not found. Please try a different search term.');
        }
        
        return {
            lat: parseFloat(data[0].lat),
            lon: parseFloat(data[0].lon),
            display_name: data[0].display_name
        };
    } catch (error) {
        console.error('Geocoding error:', error);
        throw new Error('Failed to find location. Please try again.');
    }
}

async function searchCulturalOrganizations(coords, radiusMeters) {
    const query = `
        [out:json][timeout:30];
        (
            // Museums and galleries
            node["tourism"="museum"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["tourism"="museum"](around:${radiusMeters},${coords.lat},${coords.lon});
            relation["tourism"="museum"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["tourism"="gallery"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["tourism"="gallery"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            // Arts and cultural centers
            node["amenity"="arts_centre"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["amenity"="arts_centre"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["amenity"="theatre"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["amenity"="theatre"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["amenity"="library"]["library:type"!="academic"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["amenity"="library"]["library:type"!="academic"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["amenity"="community_centre"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["amenity"="community_centre"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            // Botanical gardens and conservatories (managed venues with contact info)
            node["leisure"="botanical_garden"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["leisure"="botanical_garden"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["amenity"="botanical_garden"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["amenity"="botanical_garden"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            // Cultural facilities
            node["amenity"="cultural_centre"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["amenity"="cultural_centre"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["amenity"="exhibition_centre"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["amenity"="exhibition_centre"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            // Historic sites with visitor centers
            node["tourism"="attraction"]["historic"="yes"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["tourism"="attraction"]["historic"="yes"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["historic"="museum"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["historic"="museum"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            // Outdoor galleries (managed spaces)
            node["amenity"="outdoor_gallery"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["amenity"="outdoor_gallery"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["tourism"="gallery"]["outdoor"="yes"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["tourism"="gallery"]["outdoor"="yes"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            // Maker spaces and workshops (only pottery and general art)
            node["amenity"="workshop"]["workshop:type"~"art|craft|pottery"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["amenity"="workshop"]["workshop:type"~"art|craft|pottery"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["craft"~"pottery|artist"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["craft"~"pottery|artist"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            // Dance studios and yoga centers
            node["leisure"="dance"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["leisure"="dance"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["sport"="yoga"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["sport"="yoga"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            // Exclude retail
            node["building"="museum"]["shop"!="yes"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["building"="museum"]["shop"!="yes"](around:${radiusMeters},${coords.lat},${coords.lon});
        );
        out body;
        >;
        out skel qt;
    `;
    
    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: 'data=' + encodeURIComponent(query),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to search organizations');
        }
        
        const data = await response.json();
        const organizations = [];
        const seen = new Set();
        
        // Process results
        data.elements?.forEach(element => {
            if (!element.tags || !element.tags.name) return;
            
            const name = element.tags.name;
            const key = name.toLowerCase().trim();
            
            // Skip duplicates and excluded types
            if (seen.has(key) || isExcluded(element.tags, name)) return;
            seen.add(key);
            
            // Extract organization data
            const org = {
                name: name,
                type: getOrgType(element.tags),
                website: extractWebsite(element.tags),
                email: extractEmail(element.tags),
                phone: extractPhone(element.tags),
                address: extractAddress(element.tags),
                lat: element.lat || element.center?.lat,
                lon: element.lon || element.center?.lon
            };
            
            organizations.push(org);
        });
        
        // If no organizations found, return a message
        if (organizations.length === 0) {
            console.log('No organizations found in OpenStreetMap data');
        }
        
        return organizations;
        
    } catch (error) {
        console.error('Search error:', error);
        throw new Error('Failed to search for organizations. Please try again.');
    }
}

function isExcluded(tags, name) {
    const excludedAmenities = ['university', 'college', 'school', 'kindergarten', 'music_school', 
                              'conference_centre', 'shop', 'marketplace', 'supermarket', 'mall',
                              'concert_hall', 'music_venue', 'events_venue', 'dojo'];
    const excludedWords = ['university', 'college', 'school', 'academy', 'institute', 'campus', 
                          'student', 'retail', 'shop', 'store', 'boutique', 'mall', 'market',
                          'concert', 'symphony', 'philharmonic'];
    
    // Check amenity type
    if (excludedAmenities.includes(tags.amenity)) return true;
    
    // Check if it's a shop
    if (tags.shop) return true;
    
    // Check building type
    if (tags.building === 'university' || tags.building === 'college' || tags.building === 'retail') return true;
    
    // Check craft type
    if (tags.craft === 'glass_blower' || tags.craft === 'sculptor') return true;
    
    // Check name
    const nameLower = name.toLowerCase();
    if (excludedWords.some(word => nameLower.includes(word))) return true;
    
    // Check if it's a library at a school
    if (tags.amenity === 'library' && tags['library:type'] === 'academic') return true;
    
    // Exclude nightclubs and bars
    if (tags.amenity === 'nightclub' || tags.amenity === 'bar' || tags.amenity === 'pub') return true;
    
    // Exclude generic parks and public art without organization
    if (tags.leisure === 'park' && !tags['park:type']) return true;
    if (tags.tourism === 'artwork' && !tags.museum && !tags.gallery) return true;
    if (tags.leisure === 'garden' && !tags.operator && !tags.website) return true;
    
    // Exclude monuments and memorials without visitor centers
    if ((tags.historic === 'monument' || tags.historic === 'memorial') && !tags.tourism && !tags.museum) return true;
    
    return false;
}

function getOrgType(tags) {
    // Museums and galleries
    if (tags.tourism === 'museum') return 'Museum';
    if (tags.tourism === 'gallery') return 'Art Gallery';
    if (tags.amenity === 'outdoor_gallery' || (tags.tourism === 'gallery' && tags.outdoor === 'yes')) return 'Outdoor Gallery';
    
    // Arts and cultural centers
    if (tags.amenity === 'arts_centre' || tags.leisure === 'arts_centre') return 'Arts Center';
    if (tags.amenity === 'cultural_centre') return 'Cultural Center';
    if (tags.amenity === 'theatre') return 'Theatre';
    
    // Community spaces
    if (tags.amenity === 'library') return 'Library';
    if (tags.amenity === 'community_centre') return 'Community Center';
    if (tags.amenity === 'exhibition_centre') return 'Exhibition Center';
    
    // Gardens (only managed botanical gardens)
    if (tags.leisure === 'botanical_garden' || tags.amenity === 'botanical_garden') return 'Botanical Garden';
    
    // Exercise and wellness
    if (tags.leisure === 'dance') return 'Dance Studio';
    if (tags.sport === 'yoga') return 'Yoga Studio';
    
    // Workshops and maker spaces
    if (tags.craft === 'artist' || tags.studio === 'artist') return 'Artist Studio';
    if (tags.craft === 'pottery') return 'Pottery Studio';
    if (tags.amenity === 'workshop') return 'Creative Workshop';
    
    // Historic sites
    if (tags.historic === 'museum') return 'Historic Museum';
    if (tags.tourism === 'attraction' && tags.historic === 'yes') return 'Historic Site';
    if (tags.building === 'museum') return 'Museum Building';
    
    return 'Cultural Organization';
}

function extractWebsite(tags) {
    return tags.website || 
           tags['contact:website'] || 
           tags.url || 
           tags['contact:url'] || 
           '';
}

function extractEmail(tags) {
    return tags.email || 
           tags['contact:email'] || 
           '';
}

function extractPhone(tags) {
    return tags.phone || 
           tags['contact:phone'] || 
           tags['phone:US'] || 
           tags['contact:mobile'] || 
           '';
}

function extractAddress(tags) {
    const parts = [];
    
    if (tags['addr:housenumber']) parts.push(tags['addr:housenumber']);
    if (tags['addr:street']) parts.push(tags['addr:street']);
    if (tags['addr:city']) parts.push(tags['addr:city']);
    if (tags['addr:state']) parts.push(tags['addr:state']);
    if (tags['addr:postcode']) parts.push(tags['addr:postcode']);
    
    return parts.join(', ') || tags['addr:full'] || '';
}

function displayResults(organizations) {
    elements.resultsSection.style.display = 'block';
    elements.resultsCount.textContent = `${organizations.length} organization${organizations.length !== 1 ? 's' : ''} found`;
    
    if (organizations.length === 0) {
        elements.tableContainer.style.display = 'none';
        elements.downloadCsvBtn.disabled = true;
        showError('No cultural organizations found in this area. Try expanding your search radius or searching a different location.');
        return;
    }
    
    // Clear previous results
    elements.resultsTbody.innerHTML = '';
    
    // Add each organization to the table
    organizations.forEach(org => {
        const row = document.createElement('tr');
        
        // Name cell
        const nameCell = document.createElement('td');
        nameCell.textContent = org.name;
        row.appendChild(nameCell);
        
        // Website cell
        const websiteCell = document.createElement('td');
        if (org.website) {
            const link = document.createElement('a');
            link.href = org.website.startsWith('http') ? org.website : `https://${org.website}`;
            link.textContent = 'Visit Website';
            link.className = 'table-link';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            websiteCell.appendChild(link);
        } else {
            websiteCell.textContent = '-';
        }
        row.appendChild(websiteCell);
        
        // Contact cell
        const contactCell = document.createElement('td');
        if (org.email) {
            const mailLink = document.createElement('a');
            mailLink.href = `mailto:${org.email}`;
            mailLink.textContent = org.email;
            mailLink.className = 'table-link';
            contactCell.appendChild(mailLink);
        } else if (org.phone) {
            const phoneLink = document.createElement('a');
            phoneLink.href = `tel:${org.phone.replace(/[^\d+]/g, '')}`;
            phoneLink.textContent = org.phone;
            phoneLink.className = 'table-link';
            contactCell.appendChild(phoneLink);
        } else {
            contactCell.textContent = '-';
        }
        row.appendChild(contactCell);
        
        // Type cell
        const typeCell = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = `type-badge ${getBadgeClass(org.type)}`;
        badge.textContent = org.type;
        typeCell.appendChild(badge);
        row.appendChild(typeCell);
        
        elements.resultsTbody.appendChild(row);
    });
    
    elements.tableContainer.style.display = 'block';
    elements.downloadCsvBtn.disabled = false;
    resetSortIndicators();
}

function getBadgeClass(type) {
    const map = {
        'Museum': 'type-museum',
        'Historic Museum': 'type-museum',
        'Museum Building': 'type-museum',
        'Art Gallery': 'type-gallery',
        'Outdoor Gallery': 'type-outdoor',
        'Theatre': 'type-theatre',
        'Arts Center': 'type-arts-centre',
        'Cultural Center': 'type-arts-centre',
        'Community Center': 'type-arts-centre',
        'Exhibition Center': 'type-arts-centre',
        'Library': 'type-library',
        'Botanical Garden': 'type-garden',
        'Dance Studio': 'type-wellness',
        'Yoga Studio': 'type-wellness',
        'Artist Studio': 'type-workshop',
        'Pottery Studio': 'type-workshop',
        'Creative Workshop': 'type-workshop',
        'Historic Site': 'type-historic'
    };
    return map[type] || 'type-other';
}

function handleSort(column) {
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }
    
    const sorted = [...currentResults].sort((a, b) => {
        let aVal, bVal;
        
        // Special handling for different columns
        if (column === 'website') {
            // Sort by presence of website first, then alphabetically
            aVal = a.website ? '0' + a.website : '1';
            bVal = b.website ? '0' + b.website : '1';
        } else if (column === 'contact') {
            // Sort by presence of contact (email preferred over phone), then alphabetically
            if (a.email) {
                aVal = '0' + a.email;
            } else if (a.phone) {
                aVal = '1' + a.phone;
            } else {
                aVal = '2';
            }
            
            if (b.email) {
                bVal = '0' + b.email;
            } else if (b.phone) {
                bVal = '1' + b.phone;
            } else {
                bVal = '2';
            }
        } else {
            // Normal string sorting for other columns
            aVal = String(a[column] || '');
            bVal = String(b[column] || '');
        }
        
        const comparison = aVal.localeCompare(bVal);
        return currentSortDirection === 'asc' ? comparison : -comparison;
    });
    
    // Update sort indicators
    updateSortIndicators();
    
    // Update the table body only (don't re-render entire results section)
    updateTableBody(sorted);
}

function updateSortIndicators() {
    document.querySelectorAll('.sortable').forEach(header => {
        const indicator = header.querySelector('.sort-indicator');
        header.classList.remove('asc', 'desc');
        
        if (header.dataset.column === currentSortColumn) {
            header.classList.add(currentSortDirection);
            indicator.textContent = currentSortDirection === 'asc' ? '↑' : '↓';
        } else {
            indicator.textContent = '↕';
        }
    });
}

function resetSortIndicators() {
    document.querySelectorAll('.sortable').forEach(header => {
        header.classList.remove('asc', 'desc');
        header.querySelector('.sort-indicator').textContent = '↕';
    });
    currentSortColumn = null;
    currentSortDirection = 'asc';
}

function downloadCsv() {
    if (currentResults.length === 0) return;
    
    const headers = ['Organization Name', 'Website', 'Email', 'Phone', 'Type', 'Address'];
    const rows = [headers.join(',')];
    
    currentResults.forEach(org => {
        const row = [
            escapeCsv(org.name),
            escapeCsv(org.website),
            escapeCsv(org.email),
            escapeCsv(org.phone),
            escapeCsv(org.type),
            escapeCsv(org.address)
        ];
        rows.push(row.join(','));
    });
    
    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `cultural_organizations_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    URL.revokeObjectURL(url);
}

function escapeCsv(value) {
    if (!value) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function showLoading(message = 'Searching...') {
    elements.loadingContainer.style.display = 'flex';
    elements.tableContainer.style.display = 'none';
    elements.searchBtn.disabled = true;
    elements.searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
    updateLoadingMessage(message);
}

function hideLoading() {
    elements.loadingContainer.style.display = 'none';
    elements.searchBtn.disabled = false;
    elements.searchBtn.innerHTML = '<i class="fas fa-search"></i> <span>Discover Cultural Partners</span>';
}

function updateLoadingMessage(message) {
    const loadingText = elements.loadingContainer?.querySelector('.loading-text');
    if (loadingText) {
        loadingText.textContent = message;
    }
}

function showError(message) {
    const errorElement = elements.errorMessage;
    if (errorElement) {
        const messageSpan = errorElement.querySelector('span') || errorElement;
        messageSpan.textContent = message;
        errorElement.style.display = 'flex';
    }
}

function hideError() {
    if (elements.errorMessage) {
        elements.errorMessage.style.display = 'none';
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}