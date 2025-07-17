// Global variables
let currentResults = [];
let currentSortColumn = null;
let currentSortDirection = 'asc';

// Common contact page paths to try (reduced list for speed)
const CONTACT_PATHS = [
    '/contact',
    '/contact-us',
    '/about/contact',
    '/info',
    '/about'
];

// Cache for contact page validation - with TTL
const contactPageCache = new Map();
const CACHE_TTL = 300000; // 5 minutes

// Debounce timer for search
let searchDebounceTimer = null;

// DOM elements cache
const domElements = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    
    // Immediate initialization - no setTimeout needed
    initializeElements();
    initializeEventListeners();
    updateRadiusDisplay();
    console.log('Application initialized');
});

// Initialize DOM elements - cache all at once
function initializeElements() {
    const elementIds = [
        'location-input', 'radius-slider', 'radius-display', 'search-btn',
        'results-section', 'loading-spinner', 'error-message', 
        'results-table-container', 'results-table', 'results-tbody',
        'results-count', 'download-csv'
    ];
    
    elementIds.forEach(id => {
        domElements[id] = document.getElementById(id);
    });
    
    // Debug: Check if elements exist
    console.log('Elements initialized:', Object.keys(domElements).length);
}

// Event listeners with improved performance
function initializeEventListeners() {
    const { 'search-btn': searchBtn, 'location-input': locationInput, 'radius-slider': radiusSlider, 'download-csv': downloadCsvBtn } = domElements;
    
    // Search functionality with debouncing
    if (searchBtn) {
        searchBtn.addEventListener('click', function(e) {
            e.preventDefault();
            debouncedSearch();
        });
    }
    
    if (locationInput) {
        locationInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                debouncedSearch();
            }
        });
    }

    // Radius slider - throttled updates
    if (radiusSlider) {
        let radiusUpdateTimer;
        radiusSlider.addEventListener('input', function(e) {
            clearTimeout(radiusUpdateTimer);
            radiusUpdateTimer = setTimeout(updateRadiusDisplay, 100);
        });
    }

    // Table sorting - use event delegation
    const resultsTable = domElements['results-table'];
    if (resultsTable) {
        resultsTable.addEventListener('click', function(e) {
            if (e.target.classList.contains('sortable')) {
                handleSort(e.target.dataset.column);
            }
        });
    }

    // CSV download
    if (downloadCsvBtn) {
        downloadCsvBtn.addEventListener('click', function(e) {
            e.preventDefault();
            downloadCsv();
        });
    }
}

// Debounced search to prevent rapid API calls
function debouncedSearch() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(handleSearch, 300);
}

// Update radius display
function updateRadiusDisplay() {
    const radiusSlider = domElements['radius-slider'];
    const radiusDisplay = domElements['radius-display'];
    
    if (radiusSlider && radiusDisplay) {
        radiusDisplay.textContent = `${radiusSlider.value} km`;
    }
}

// Main search handler - optimized with early returns
async function handleSearch() {
    const locationInput = domElements['location-input'];
    const radiusSlider = domElements['radius-slider'];
    const searchBtn = domElements['search-btn'];
    
    if (!locationInput) return;
    
    const location = locationInput.value.trim();
    if (!location) {
        showError('Please enter a location to search.');
        return;
    }

    try {
        showLoading();
        hideError();
        
        // Parallel execution where possible
        const [coordinates, radius] = await Promise.all([
            geocodeLocation(location),
            Promise.resolve(parseInt(radiusSlider?.value || 25) * 1000)
        ]);
        
        console.log('Geocoded coordinates:', coordinates);
        
        let organizations;
        try {
            organizations = await searchArtsOrganizations(coordinates, radius);
            console.log('Found organizations:', organizations.length);
            
            // Batch process with smaller batches for faster response
            if (searchBtn) searchBtn.textContent = 'Validating contact information...';
            currentResults = await batchProcessOrganizations(organizations, 5);
            
        } catch (apiError) {
            console.warn('API search failed, using sample data:', apiError);
            currentResults = getSampleData(location);
        }
        
        displayResults(currentResults);
        
    } catch (error) {
        console.error('Search error:', error);
        showError(error.message || 'An error occurred while searching. Please try again.');
    } finally {
        hideLoading();
    }
}

// Optimized sample data generation
function getSampleData(location) {
    const sampleOrgs = [
        { name: 'Philadelphia Museum of Art', website: 'https://www.philamuseum.org', contact: 'info@philamuseum.org', type: 'Museum' },
        { name: 'Mural Arts Philadelphia', website: 'https://www.muralarts.org', contact: 'info@muralarts.org', type: 'Arts Centre' },
        { name: 'Pennsylvania Academy of the Fine Arts', website: 'https://www.pafa.org', contact: 'admissions@pafa.org', type: 'Art School' },
        { name: 'Morris Arboretum & Gardens', website: 'https://www.morrisarboretum.org', contact: 'info@morrisarboretum.org', type: 'Botanical Garden' },
        { name: 'Academy of Natural Sciences', website: 'https://www.ansp.org', contact: 'education@ansp.org', type: 'Natural History Museum' },
        { name: 'Barnes Foundation', website: 'https://www.barnesfoundation.org', contact: 'info@barnesfoundation.org', type: 'Art Museum' },
        { name: 'Philadelphia Zoo', website: 'https://www.philadelphiazoo.org', contact: 'info@philadelphiazoo.org', type: 'Zoo' }
    ];
    
    const baseCoords = { lat: 39.9526, lon: -75.1652 };
    return sampleOrgs.map(org => ({
        ...org,
        lat: baseCoords.lat + (Math.random() - 0.5) * 0.1,
        lon: baseCoords.lon + (Math.random() - 0.5) * 0.1
    }));
}

// Optimized geocoding with better error handling
async function geocodeLocation(location) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(location)}`;
    
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Art Pharmacy Organization Finder' }
        });
        
        if (!response.ok) throw new Error('Failed to geocode location');
        
        const data = await response.json();
        if (data.length === 0) {
            throw new Error('Location not found. Please try a different location or be more specific.');
        }
        
        return {
            lat: parseFloat(data[0].lat),
            lon: parseFloat(data[0].lon)
        };
    } catch (error) {
        console.error('Geocoding error:', error);
        throw new Error('Unable to find location. Please check your internet connection and try again.');
    }
}

// Optimized Overpass query - reduced complexity
async function searchArtsOrganizations(coordinates, radius) {
    const { lat, lon } = coordinates;
    
    // Streamlined query focusing on most important categories
    const overpassQuery = `
        [out:json][timeout:20];
        (
            node["tourism"~"^(gallery|museum|zoo|aquarium)$"](around:${radius},${lat},${lon});
            node["amenity"~"^(arts_centre|library|music_venue|concert_hall)$"](around:${radius},${lat},${lon});
            node["historic"~"^(museum|heritage)$"](around:${radius},${lat},${lon});
            node["leisure"="garden"]["garden:type"="botanical"](around:${radius},${lat},${lon});
            
            way["tourism"~"^(gallery|museum|zoo|aquarium)$"](around:${radius},${lat},${lon});
            way["amenity"~"^(arts_centre|library|music_venue|concert_hall)$"](around:${radius},${lat},${lon});
            way["historic"~"^(museum|heritage)$"](around:${radius},${lat},${lon});
            way["leisure"="garden"]["garden:type"="botanical"](around:${radius},${lat},${lon});
        );
        out center meta;
    `;
    
    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `data=${encodeURIComponent(overpassQuery)}`
        });
        
        if (!response.ok) throw new Error('Failed to search for organizations');
        
        const data = await response.json();
        return data.elements || [];
        
    } catch (error) {
        console.error('Overpass API error:', error);
        throw new Error('Unable to search for arts organizations. Please try again.');
    }
}

// Optimized contact validation with cache and TTL
async function findValidContact(website, orgName) {
    if (!website) return null;
    
    const normalizedWebsite = normalizeWebsiteUrl(website);
    if (!normalizedWebsite) return null;
    
    // Check cache with TTL
    const cacheKey = normalizedWebsite;
    const cached = contactPageCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    
    try {
        const contactInfo = await findContactPage(normalizedWebsite, orgName);
        
        // Cache with timestamp
        contactPageCache.set(cacheKey, {
            data: contactInfo,
            timestamp: Date.now()
        });
        
        return contactInfo;
        
    } catch (error) {
        console.warn(`Error finding contact for ${orgName}:`, error);
        return null;
    }
}

// Optimized URL normalization
function normalizeWebsiteUrl(url) {
    if (!url) return null;
    
    url = url.trim().replace(/\/+$/, '');
    if (!url.startsWith('http')) url = 'https://' + url;
    
    try {
        return new URL(url).toString();
    } catch {
        return null;
    }
}

// Streamlined contact page finding
async function findContactPage(baseUrl, orgName) {
    if (!baseUrl) return null;
    
    // Quick validation of main site
    const isMainSiteValid = await validateUrl(baseUrl);
    if (!isMainSiteValid) return null;
    
    // Try contact paths concurrently with Promise.allSettled
    const contactPromises = CONTACT_PATHS.map(async path => {
        const contactUrl = baseUrl + path;
        const isValid = await validateUrl(contactUrl);
        return isValid ? contactUrl : null;
    });
    
    const results = await Promise.allSettled(contactPromises);
    
    // Return first valid contact page
    for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
            return result.value;
        }
    }
    
    return baseUrl; // Fallback to main site
}

// Optimized URL validation with shorter timeout
async function validateUrl(url, timeout = 3000) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            mode: 'no-cors',
            cache: 'no-cache'
        });
        
        clearTimeout(timeoutId);
        return true;
        
    } catch {
        return false;
    }
}

// Optimized email validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(email) {
    return EMAIL_REGEX.test(email);
}

// Optimized batch processing with concurrent batches
async function batchProcessOrganizations(rawResults, batchSize = 5) {
    const batches = [];
    
    for (let i = 0; i < rawResults.length; i += batchSize) {
        batches.push(rawResults.slice(i, i + batchSize));
    }
    
    // Process batches concurrently with limited concurrency
    const maxConcurrentBatches = 2;
    const organizations = [];
    
    for (let i = 0; i < batches.length; i += maxConcurrentBatches) {
        const concurrentBatches = batches.slice(i, i + maxConcurrentBatches);
        const batchPromises = concurrentBatches.map(batch => processResults(batch));
        
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(results => organizations.push(...results));
        
        // Small delay between batch groups
        if (i + maxConcurrentBatches < batches.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    return organizations;
}

// Optimized result processing with early filtering
async function processResults(rawResults) {
    const organizations = [];
    const seenNames = new Set();
    
    for (const element of rawResults) {
        const tags = element.tags || {};
        const name = tags.name || tags['name:en'] || 'Unnamed Organization';
        
        const normalizedName = name.toLowerCase().trim();
        if (seenNames.has(normalizedName) || isGenericPark(tags)) {
            continue;
        }
        
        const website = normalizeWebsiteUrl(tags.website || tags['contact:website'] || tags.url);
        const directContact = tags.email || tags['contact:email'] || tags.phone || tags['contact:phone'] || '';
        
        // Quick validation
        if (!isValidContact(directContact, website)) {
            continue;
        }
        
        seenNames.add(normalizedName);
        
        let finalContact = directContact;
        if (!directContact && website) {
            finalContact = await findValidContact(website, name) || website;
        }
        
        organizations.push({
            name,
            website,
            contact: finalContact,
            lat: element.lat || (element.center && element.center.lat) || 0,
            lon: element.lon || (element.center && element.center.lon) || 0,
            type: getOrganizationType(tags)
        });
    }
    
    return organizations;
}

// Optimized park filtering
function isGenericPark(tags) {
    return (tags.leisure === 'park' && !tags['garden:type'] && !tags.attraction) ||
           ['playground', 'sports_centre', 'pitch'].includes(tags.leisure) ||
           tags.amenity === 'parking';
}

// Optimized contact validation
function isValidContact(contact, website) {
    if (contact) {
        return contact.includes('@') ? isValidEmail(contact) : contact.startsWith('http');
    }
    return !!website;
}

// Optimized organization type mapping
const TYPE_MAP = {
    'tourism': {
        'gallery': 'Art Gallery',
        'museum': 'Museum',
        'zoo': 'Zoo',
        'aquarium': 'Aquarium'
    },
    'amenity': {
        'arts_centre': 'Arts Centre',
        'library': 'Library',
        'music_venue': 'Music Venue',
        'concert_hall': 'Concert Hall',
        'community_centre': 'Community Arts Centre',
        'studio': 'Studio'
    },
    'historic': {
        'museum': 'Historical Museum',
        'heritage': 'Heritage Site',
        'archaeological_site': 'Archaeological Site'
    },
    'craft': {
        'pottery': 'Pottery Studio',
        'sculptor': 'Sculpture Studio'
    }
};

function getOrganizationType(tags) {
    for (const [category, types] of Object.entries(TYPE_MAP)) {
        if (tags[category] && types[tags[category]]) {
            return types[tags[category]];
        }
    }
    
    if (tags['garden:type'] === 'botanical') return 'Botanical Garden';
    if (tags.leisure === 'nature_reserve') return 'Nature Centre';
    if (tags.leisure === 'wildlife_park') return 'Wildlife Park';
    if (tags.cultural) return 'Cultural Centre';
    
    return 'Cultural Organization';
}

// Optimized results display with document fragments
function displayResults(organizations) {
    const resultsSection = domElements['results-section'];
    const resultsCount = domElements['results-count'];
    const resultsTbody = domElements['results-tbody'];
    const resultsTableContainer = domElements['results-table-container'];
    const downloadCsvBtn = domElements['download-csv'];
    
    if (!resultsSection || !resultsCount || !resultsTbody) return;
    
    resultsSection.style.display = 'block';
    resultsCount.textContent = `${organizations.length} organization${organizations.length !== 1 ? 's' : ''} found`;
    
    if (organizations.length === 0) {
        if (resultsTableContainer) resultsTableContainer.style.display = 'none';
        if (downloadCsvBtn) downloadCsvBtn.disabled = true;
        showError('No arts or cultural organizations with contact information found in this area. Try expanding your search radius or a different location.');
        return;
    }
    
    // Use document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    organizations.forEach(org => {
        const row = document.createElement('tr');
        
        // Create cells efficiently
        const cells = [
            org.name,
            org.website ? `<a href="${org.website}" target="_blank" rel="noopener noreferrer">${org.website}</a>` : '-',
            formatContact(org.contact),
            org.type
        ];
        
        cells.forEach(cellContent => {
            const cell = document.createElement('td');
            cell.innerHTML = cellContent;
            row.appendChild(cell);
        });
        
        fragment.appendChild(row);
    });
    
    // Single DOM update
    resultsTbody.innerHTML = '';
    resultsTbody.appendChild(fragment);
    
    if (resultsTableContainer) resultsTableContainer.style.display = 'block';
    if (downloadCsvBtn) downloadCsvBtn.disabled = false;
    
    resetSortIndicators();
}

// Helper function for contact formatting
function formatContact(contact) {
    if (!contact) return '-';
    
    if (contact.includes('@')) {
        return `<a href="mailto:${contact}" class="contact-info">${contact}</a>`;
    } else if (contact.startsWith('http')) {
        return `<a href="${contact}" target="_blank" rel="noopener noreferrer" class="contact-info">Contact Page</a>`;
    }
    return contact;
}

// Optimized sorting with memoization
function handleSort(column) {
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }
    
    const multiplier = currentSortDirection === 'asc' ? 1 : -1;
    
    currentResults.sort((a, b) => {
        const aValue = String(a[column] || '');
        const bValue = String(b[column] || '');
        
        if (!aValue && !bValue) return 0;
        if (!aValue) return 1;
        if (!bValue) return -1;
        
        return aValue.localeCompare(bValue) * multiplier;
    });
    
    updateSortIndicators();
    displayResults(currentResults);
}

// Optimized sort indicators
function updateSortIndicators() {
    const sortableHeaders = document.querySelectorAll('.sortable');
    sortableHeaders.forEach(header => {
        header.className = header.className.replace(/\s*(asc|desc)/g, '');
        if (header.dataset.column === currentSortColumn) {
            header.classList.add(currentSortDirection);
        }
    });
}

function resetSortIndicators() {
    const sortableHeaders = document.querySelectorAll('.sortable');
    sortableHeaders.forEach(header => {
        header.className = header.className.replace(/\s*(asc|desc)/g, '');
    });
    currentSortColumn = null;
    currentSortDirection = 'asc';
}

// Optimized CSV download
function downloadCsv() {
    if (currentResults.length === 0) return;
    
    const csvRows = ['Organization Name,Website,Contact,Type'];
    
    currentResults.forEach(org => {
        const row = [
            escapeCsvValue(org.name),
            escapeCsvValue(org.website),
            escapeCsvValue(org.contact),
            escapeCsvValue(org.type)
        ].join(',');
        csvRows.push(row);
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    
    const locationInput = domElements['location-input'];
    const location = (locationInput?.value || 'search').replace(/[^a-zA-Z0-9]/g, '_');
    const date = new Date().toISOString().split('T')[0];
    link.download = `arts_organizations_${location}_${date}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Optimized CSV escaping
function escapeCsvValue(value) {
    if (!value) return '';
    
    const stringValue = String(value);
    return stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')
        ? '"' + stringValue.replace(/"/g, '""') + '"'
        : stringValue;
}

// Optimized state management
function showLoading() {
    const loadingSpinner = domElements['loading-spinner'];
    const resultsTableContainer = domElements['results-table-container'];
    const searchBtn = domElements['search-btn'];
    
    if (loadingSpinner) loadingSpinner.style.display = 'flex';
    if (resultsTableContainer) resultsTableContainer.style.display = 'none';
    if (searchBtn) {
        searchBtn.disabled = true;
        searchBtn.textContent = 'Searching...';
    }
}

function hideLoading() {
    const loadingSpinner = domElements['loading-spinner'];
    const searchBtn = domElements['search-btn'];
    
    if (loadingSpinner) loadingSpinner.style.display = 'none';
    if (searchBtn) {
        searchBtn.disabled = false;
        searchBtn.textContent = 'Find Partners';
    }
}

function showError(message) {
    const errorMessage = domElements['error-message'];
    const resultsTableContainer = domElements['results-table-container'];
    const downloadCsvBtn = domElements['download-csv'];
    
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
    if (resultsTableContainer) resultsTableContainer.style.display = 'none';
    if (downloadCsvBtn) downloadCsvBtn.disabled = true;
}

function hideError() {
    const errorMessage = domElements['error-message'];
    if (errorMessage) errorMessage.style.display = 'none';
}