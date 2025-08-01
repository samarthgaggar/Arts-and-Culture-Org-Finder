// Global variables
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
        updateLoadingMessage('Searching for cultural, wellness, and nature organizations...');
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
            
            // Gardens and nature (only managed facilities with contact info)
            node["leisure"="botanical_garden"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["leisure"="botanical_garden"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["tourism"="zoo"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["tourism"="zoo"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["tourism"="aquarium"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["tourism"="aquarium"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["leisure"="nature_reserve"]["visitor_centre"="yes"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["leisure"="nature_reserve"]["visitor_centre"="yes"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["amenity"="visitor_centre"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["amenity"="visitor_centre"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["information"="visitor_centre"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["information"="visitor_centre"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            // Health and wellness
            node["leisure"="spa"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["leisure"="spa"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["amenity"="spa"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["amenity"="spa"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["leisure"="yoga"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["leisure"="yoga"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["sport"="yoga"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["sport"="yoga"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["sport"="pilates"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["sport"="pilates"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["leisure"="dance"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["leisure"="dance"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            // Cultural facilities
            node["amenity"="cultural_centre"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["amenity"="cultural_centre"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["amenity"="exhibition_centre"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["amenity"="exhibition_centre"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            // Historic sites
            node["historic"="museum"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["historic"="museum"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["tourism"="attraction"]["historic"="yes"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["tourism"="attraction"]["historic"="yes"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            // Creative spaces
            node["craft"~"pottery|artist"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["craft"~"pottery|artist"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["amenity"="workshop"]["workshop:type"~"art|craft|pottery"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["amenity"="workshop"]["workshop:type"~"art|craft|pottery"](around:${radiusMeters},${coords.lat},${coords.lon});
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
            const website = extractWebsite(element.tags);
            const org = {
                name: name,
                type: getOrgType(element.tags),
                website: website,
                email: extractEmail(element.tags),
                phone: extractPhone(element.tags),
                contactPage: website ? generateContactPageUrl(website) : '',
                address: extractAddress(element.tags),
                lat: element.lat || element.center?.lat,
                lon: element.lon || element.center?.lon
            };
            
            organizations.push(org);
        });
        
        return organizations;
        
    } catch (error) {
        console.error('Search error:', error);
        throw new Error('Failed to search for organizations. Please try again.');
    }
}

function isExcluded(tags, name) {
    const excludedAmenities = [
        'university', 'college', 'school', 'kindergarten', 'music_school',
        'conference_centre', 'shop', 'marketplace', 'supermarket', 'mall',
        'concert_hall', 'music_venue', 'events_venue', 'dojo'
    ];
    
    const excludedWords = [
        'university', 'college', 'school', 'academy', 'institute', 'campus',
        'student', 'retail', 'shop', 'store', 'boutique', 'mall', 'market',
        'concert', 'symphony', 'philharmonic'
    ];
    
    // Check amenity type
    if (excludedAmenities.includes(tags.amenity)) return true;
    
    // Check if it's a shop
    if (tags.shop) return true;
    
    // Check building type
    if (tags.building === 'university' || tags.building === 'college' || tags.building === 'retail') return true;
    
    // Check name
    const nameLower = name.toLowerCase();
    if (excludedWords.some(word => nameLower.includes(word))) return true;
    
    // Check if it's a library at a school
    if (tags.amenity === 'library' && tags['library:type'] === 'academic') return true;
    
    // Exclude generic parks without facilities
    if (tags.leisure === 'park' && !tags.operator && !tags.website) return true;
    if (tags.leisure === 'garden' && !tags.operator && !tags.website && tags['garden:type'] !== 'botanical') return true;
    if (tags.leisure === 'nature_reserve' && tags.visitor_centre !== 'yes') return true;
    
    // Exclude bars and nightclubs
    if (tags.amenity === 'nightclub' || tags.amenity === 'bar' || tags.amenity === 'pub') return true;
    
    return false;
}

function getOrgType(tags) {
    if (tags.tourism === 'museum') return 'Museum';
    if (tags.tourism === 'gallery') return 'Art Gallery';
    if (tags.amenity === 'arts_centre' || tags.leisure === 'arts_centre') return 'Arts Center';
    if (tags.amenity === 'theatre') return 'Theatre';
    if (tags.amenity === 'library') return 'Library';
    if (tags.amenity === 'community_centre') return 'Community Center';
    if (tags.amenity === 'exhibition_centre') return 'Exhibition Center';
    if (tags.amenity === 'cultural_centre') return 'Cultural Center';
    
    // Nature and gardens
    if (tags.leisure === 'botanical_garden' || tags['garden:type'] === 'botanical') return 'Botanical Garden';
    if (tags.tourism === 'zoo') return 'Zoo';
    if (tags.tourism === 'aquarium') return 'Aquarium';
    if (tags.leisure === 'nature_reserve') return 'Nature Reserve';
    if (tags.amenity === 'visitor_centre' || tags.information === 'visitor_centre') return 'Visitor Center';
    
    // Health and wellness
    if (tags.amenity === 'spa' || tags.leisure === 'spa') return 'Spa & Wellness';
    if (tags.sport === 'yoga' || tags.leisure === 'yoga') return 'Yoga Studio';
    if (tags.sport === 'pilates') return 'Pilates Studio';
    if (tags.leisure === 'dance') return 'Dance Studio';
    
    // Creative spaces
    if (tags.craft === 'artist') return 'Artist Studio';
    if (tags.craft === 'pottery') return 'Pottery Studio';
    if (tags.amenity === 'workshop') return 'Creative Workshop';
    
    // Historic
    if (tags.historic === 'museum') return 'Historic Museum';
    if (tags.tourism === 'attraction' && tags.historic === 'yes') return 'Historic Site';
    
    return 'Cultural Organization';
}

function extractWebsite(tags) {
    return tags.website || tags['contact:website'] || tags.url || tags['contact:url'] || '';
}

function extractEmail(tags) {
    return tags.email || tags['contact:email'] || '';
}

function extractPhone(tags) {
    return tags.phone || tags['contact:phone'] || tags['phone:US'] || tags['contact:mobile'] || '';
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

function generateContactPageUrl(website) {
    if (!website) return '';
    
    const baseUrl = website.startsWith('http') ? website : `https://${website}`;
    
    try {
        const url = new URL(baseUrl);
        const base = url.origin + url.pathname.replace(/\/$/, '');
        return base + '/contact';
    } catch (e) {
        return '';
    }
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
        
        // Contact cell - prioritized display
        const contactCell = document.createElement('td');
        if (org.email) {
            const mailLink = document.createElement('a');
            mailLink.href = `mailto:${org.email}`;
            mailLink.textContent = org.email;
            mailLink.className = 'table-link';
            contactCell.appendChild(mailLink);
        } else if (org.contactPage) {
            const contactLink = document.createElement('a');
            contactLink.href = org.contactPage;
            contactLink.textContent = 'Contact Page';
            contactLink.className = 'table-link';
            contactLink.target = '_blank';
            contactLink.rel = 'noopener noreferrer';
            contactCell.appendChild(contactLink);
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
        'Art Gallery': 'type-gallery',
        'Theatre': 'type-theatre',
        'Arts Center': 'type-arts-centre',
        'Cultural Center': 'type-arts-centre',
        'Community Center': 'type-arts-centre',
        'Exhibition Center': 'type-arts-centre',
        'Library': 'type-library',
        'Visitor Center': 'type-library',
        'Botanical Garden': 'type-garden',
        'Zoo': 'type-garden',
        'Aquarium': 'type-garden',
        'Nature Reserve': 'type-garden',
        'Spa & Wellness': 'type-wellness',
        'Yoga Studio': 'type-wellness',
        'Pilates Studio': 'type-wellness',
        'Dance Studio': 'type-wellness',
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
        
        if (column === 'website') {
            aVal = a.website ? '0' + a.website : '1';
            bVal = b.website ? '0' + b.website : '1';
        } else if (column === 'contact') {
            if (a.email) {
                aVal = '0' + a.email;
            } else if (a.contactPage) {
                aVal = '1' + a.contactPage;
            } else if (a.phone) {
                aVal = '2' + a.phone;
            } else {
                aVal = '3';
            }
            
            if (b.email) {
                bVal = '0' + b.email;
            } else if (b.contactPage) {
                bVal = '1' + b.contactPage;
            } else if (b.phone) {
                bVal = '2' + b.phone;
            } else {
                bVal = '3';
            }
        } else {
            aVal = String(a[column] || '');
            bVal = String(b[column] || '');
        }
        
        const comparison = aVal.localeCompare(bVal);
        return currentSortDirection === 'asc' ? comparison : -comparison;
    });
    
    updateSortIndicators();
    updateTableBody(sorted);
}

function updateTableBody(organizations) {
    elements.resultsTbody.innerHTML = '';
    
    organizations.forEach(org => {
        const row = document.createElement('tr');
        
        const nameCell = document.createElement('td');
        nameCell.textContent = org.name;
        row.appendChild(nameCell);
        
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
        
        const contactCell = document.createElement('td');
        if (org.email) {
            const mailLink = document.createElement('a');
            mailLink.href = `mailto:${org.email}`;
            mailLink.textContent = org.email;
            mailLink.className = 'table-link';
            contactCell.appendChild(mailLink);
        } else if (org.contactPage) {
            const contactLink = document.createElement('a');
            contactLink.href = org.contactPage;
            contactLink.textContent = 'Contact Page';
            contactLink.className = 'table-link';
            contactLink.target = '_blank';
            contactLink.rel = 'noopener noreferrer';
            contactCell.appendChild(contactLink);
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
        
        const typeCell = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = `type-badge ${getBadgeClass(org.type)}`;
        badge.textContent = org.type;
        typeCell.appendChild(badge);
        row.appendChild(typeCell);
        
        elements.resultsTbody.appendChild(row);
    });
    
    elements.resultsCount.textContent = `${organizations.length} organization${organizations.length !== 1 ? 's' : ''} found`;
    currentResults = organizations;
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
    
    const headers = ['Organization Name', 'Website', 'Email', 'Phone', 'Contact Page', 'Type', 'Address'];
    const rows = [headers.join(',')];
    
    currentResults.forEach(org => {
        const row = [
            escapeCsv(org.name),
            escapeCsv(org.website),
            escapeCsv(org.email),
            escapeCsv(org.phone),
            escapeCsv(org.contactPage),
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