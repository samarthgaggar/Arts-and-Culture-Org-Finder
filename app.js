// Global variables
let currentResults = [];
let currentSortColumn = null;
let currentSortDirection = 'asc';

// DOM elements
let locationInput, radiusSlider, radiusDisplay, searchBtn;
let resultsSection, loadingContainer, errorMessage, tableContainer, resultsTbody, resultsCount, downloadCsvBtn;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    initializeElements();
    initializeEventListeners();
    updateRadiusDisplay(); // Set initial value
    console.log('Application initialized');
});

function initializeElements() {
    locationInput = document.getElementById('location-input');
    radiusSlider = document.getElementById('radius-slider');
    radiusDisplay = document.getElementById('radius-display');
    searchBtn = document.getElementById('search-btn');
    resultsSection = document.getElementById('results-section');
    loadingContainer = document.getElementById('loading-container');
    errorMessage = document.getElementById('error-message');
    tableContainer = document.getElementById('table-container');
    resultsTbody = document.getElementById('results-tbody');
    resultsCount = document.getElementById('results-count');
    downloadCsvBtn = document.getElementById('download-csv');
    
    // Debug log to check elements
    console.log('Elements found:', {
        locationInput: !!locationInput,
        radiusSlider: !!radiusSlider,
        radiusDisplay: !!radiusDisplay,
        searchBtn: !!searchBtn
    });
}

function initializeEventListeners() {
    // Search button
    if (searchBtn) {
        searchBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Search button clicked');
            handleSearch();
        });
        console.log('Search button listener added');
    }
    
    // Location input
    if (locationInput) {
        locationInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
            }
        });
        console.log('Location input listener added');
    }

    // Radius slider - multiple event listeners for better compatibility
    if (radiusSlider) {
        radiusSlider.addEventListener('input', function(e) {
            console.log('Slider input event:', e.target.value);
            updateRadiusDisplay();
        });
        
        radiusSlider.addEventListener('change', function(e) {
            console.log('Slider change event:', e.target.value);
            updateRadiusDisplay();
        });
        
        // Additional listener for mouse events
        radiusSlider.addEventListener('mousemove', function(e) {
            if (e.buttons === 1) { // Only if mouse is pressed
                updateRadiusDisplay();
            }
        });
        
        console.log('Radius slider listeners added');
    } else {
        console.error('Radius slider not found!');
    }

    // Table sorting
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            console.log('Sort by:', header.dataset.column);
            handleSort(header.dataset.column);
        });
    });

    // CSV download
    if (downloadCsvBtn) {
        downloadCsvBtn.addEventListener('click', function(e) {
            e.preventDefault();
            downloadCsv();
        });
        console.log('Download CSV listener added');
    }
}

function updateRadiusDisplay() {
    if (radiusSlider && radiusDisplay) {
        const value = radiusSlider.value;
        radiusDisplay.textContent = `${value} km`;
        console.log('Radius display updated to:', value + ' km');
    } else {
        console.error('Radius elements missing:', {
            slider: !!radiusSlider,
            display: !!radiusDisplay
        });
    }
}

async function handleSearch() {
    console.log('handleSearch called');
    
    if (!locationInput) {
        console.error('Location input not found');
        return;
    }
    
    const location = locationInput.value.trim();
    console.log('Location input value:', location);
    
    if (!location) {
        showError('Please enter a location to search.');
        return;
    }

    try {
        showLoading();
        hideError();
        
        console.log('Starting search for:', location);
        
        // Step 1: Geocode the location
        const coordinates = await geocodeLocation(location);
        console.log('Geocoded coordinates:', coordinates);
        
        // Step 2: Search for arts organizations
        const radius = parseInt(radiusSlider?.value || 25) * 1000; // Convert km to meters
        const organizations = await searchArtsOrganizations(coordinates, radius);
        console.log('Found organizations:', organizations.length);
        
        // Step 3: Process and display results
        currentResults = processResults(organizations);
        displayResults(currentResults);
        
    } catch (error) {
        console.error('Search error:', error);
        showError(error.message || 'An error occurred while searching. Please try again.');
    } finally {
        hideLoading();
    }
}

async function geocodeLocation(location) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(location)}`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Art-Pharmacy-Finder/1.0'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to find location');
        }
        
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

async function searchArtsOrganizations(coordinates, radius) {
    const { lat, lon } = coordinates;
    
    // Comprehensive Overpass query
    const overpassQuery = `
        [out:json][timeout:30];
        (
            // Museums and Galleries
            node["tourism"="gallery"](around:${radius},${lat},${lon});
            node["tourism"="museum"](around:${radius},${lat},${lon});
            node["historic"="museum"](around:${radius},${lat},${lon});
            way["tourism"="gallery"](around:${radius},${lat},${lon});
            way["tourism"="museum"](around:${radius},${lat},${lon});
            way["historic"="museum"](around:${radius},${lat},${lon});

            // Arts and Culture Centers
            node["amenity"="arts_centre"](around:${radius},${lat},${lon});
            node["amenity"="community_centre"](around:${radius},${lat},${lon});
            node["amenity"="cultural_centre"](around:${radius},${lat},${lon});
            way["amenity"="arts_centre"](around:${radius},${lat},${lon});
            way["amenity"="community_centre"](around:${radius},${lat},${lon});
            way["amenity"="cultural_centre"](around:${radius},${lat},${lon});

            // Performing Arts
            node["amenity"="theatre"](around:${radius},${lat},${lon});
            node["amenity"="cinema"](around:${radius},${lat},${lon});
            node["amenity"="music_venue"](around:${radius},${lat},${lon});
            node["amenity"="concert_hall"](around:${radius},${lat},${lon});
            way["amenity"="theatre"](around:${radius},${lat},${lon});
            way["amenity"="cinema"](around:${radius},${lat},${lon});
            way["amenity"="music_venue"](around:${radius},${lat},${lon});
            way["amenity"="concert_hall"](around:${radius},${lat},${lon});

            // Educational and Libraries
            node["amenity"="library"](around:${radius},${lat},${lon});
            way["amenity"="library"](around:${radius},${lat},${lon});

            // Studios and Workshops
            node["amenity"="studio"](around:${radius},${lat},${lon});
            node["craft"="pottery"](around:${radius},${lat},${lon});
            node["craft"="artist"](around:${radius},${lat},${lon});
            node["shop"="art"](around:${radius},${lat},${lon});
            way["amenity"="studio"](around:${radius},${lat},${lon});
            way["craft"="pottery"](around:${radius},${lat},${lon});
            way["craft"="artist"](around:${radius},${lat},${lon});
            way["shop"="art"](around:${radius},${lat},${lon});

            // Nature and Science
            node["tourism"="zoo"](around:${radius},${lat},${lon});
            node["tourism"="aquarium"](around:${radius},${lat},${lon});
            node["leisure"="garden"]["garden:type"="botanical"](around:${radius},${lat},${lon});
            way["tourism"="zoo"](around:${radius},${lat},${lon});
            way["tourism"="aquarium"](around:${radius},${lat},${lon});
            way["leisure"="garden"]["garden:type"="botanical"](around:${radius},${lat},${lon});

            // Historical sites
            node["historic"="heritage"](around:${radius},${lat},${lon});
            node["historic"="castle"](around:${radius},${lat},${lon});
            node["historic"="monument"](around:${radius},${lat},${lon});
            way["historic"="heritage"](around:${radius},${lat},${lon});
            way["historic"="castle"](around:${radius},${lat},${lon});
            way["historic"="monument"](around:${radius},${lat},${lon});
        );
        out center meta;
    `;
    
    try {
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `data=${encodeURIComponent(overpassQuery)}`
        });
        
        if (!response.ok) {
            throw new Error('Failed to search for organizations');
        }
        
        const data = await response.json();
        return data.elements || [];
        
    } catch (error) {
        console.error('Overpass API error:', error);
        throw new Error('Unable to search for arts organizations. Please try again.');
    }
}

function processResults(rawResults) {
    const organizations = [];
    const seenNames = new Set();
    
    for (const element of rawResults) {
        const tags = element.tags || {};
        const name = tags.name || tags['name:en'] || 'Unnamed Organization';
        
        // Skip if we've already seen this name (deduplication)
        const normalizedName = name.toLowerCase().trim();
        if (seenNames.has(normalizedName)) {
            continue;
        }
        
        // Skip generic or irrelevant entries
        if (isIrrelevantEntry(tags, name)) {
            continue;
        }
        
        seenNames.add(normalizedName);
        
        // Extract website
        let website = tags.website || tags['contact:website'] || tags.url || '';
        if (website && !website.startsWith('http')) {
            website = 'https://' + website;
        }
        
        // Extract contact info
        let contact = tags.email || tags['contact:email'] || tags.phone || tags['contact:phone'] || '';
        
        organizations.push({
            name: name,
            website: website || '',
            contact: contact || '',
            lat: element.lat || (element.center && element.center.lat) || 0,
            lon: element.lon || (element.center && element.center.lon) || 0,
            type: getOrganizationType(tags)
        });
    }
    
    return organizations;
}

function isIrrelevantEntry(tags, name) {
    // Exclude generic infrastructure
    if (tags.amenity === 'parking' || tags.amenity === 'toilets') return true;
    if (tags.leisure === 'playground' && !tags.cultural) return true;
    if (tags.leisure === 'sports_centre' && !tags.cultural) return true;
    
    // Exclude very generic parks without cultural significance
    if (tags.leisure === 'park' && !tags['garden:type'] && !tags.attraction && !tags.historic) {
        return true;
    }
    
    // Exclude generic commercial buildings
    if (tags.building === 'commercial' && !tags.amenity && !tags.shop && !tags.craft) {
        return true;
    }
    
    return false;
}

function getOrganizationType(tags) {
    // Museums and galleries
    if (tags.tourism === 'gallery') return 'Art Gallery';
    if (tags.tourism === 'museum') return 'Museum';
    if (tags.historic === 'museum') return 'Historical Museum';
    
    // Nature and science
    if (tags.tourism === 'zoo') return 'Zoo';
    if (tags.tourism === 'aquarium') return 'Aquarium';
    if (tags.leisure === 'garden' && tags['garden:type'] === 'botanical') return 'Botanical Garden';
    
    // Performing arts
    if (tags.amenity === 'theatre') return 'Theatre';
    if (tags.amenity === 'cinema') return 'Cinema';
    if (tags.amenity === 'music_venue') return 'Music Venue';
    if (tags.amenity === 'concert_hall') return 'Concert Hall';
    
    // Arts and culture centres
    if (tags.amenity === 'arts_centre') return 'Arts Centre';
    if (tags.amenity === 'community_centre') return 'Community Centre';
    if (tags.amenity === 'cultural_centre') return 'Cultural Centre';
    
    // Educational and libraries
    if (tags.amenity === 'library') return 'Library';
    
    // Studios and workshops
    if (tags.amenity === 'studio') return 'Studio';
    if (tags.craft === 'pottery') return 'Pottery Studio';
    if (tags.craft === 'artist') return 'Artist Studio';
    if (tags.shop === 'art') return 'Art Shop';
    
    // Historical sites
    if (tags.historic === 'heritage') return 'Heritage Site';
    if (tags.historic === 'castle') return 'Historic Castle';
    if (tags.historic === 'monument') return 'Monument';
    
    return 'Cultural Organization';
}

function displayResults(organizations) {
    console.log('displayResults called with', organizations.length, 'organizations');
    
    if (!resultsSection || !resultsCount || !resultsTbody) {
        console.error('Required elements not found for displaying results');
        return;
    }
    
    resultsSection.style.display = 'block';
    resultsCount.textContent = `${organizations.length} organization${organizations.length !== 1 ? 's' : ''} found`;
    
    if (organizations.length === 0) {
        tableContainer.style.display = 'none';
        downloadCsvBtn.disabled = true;
        showError('No arts or cultural organizations found in this area. Try expanding your search radius or a different location.');
        return;
    }
    
    // Clear previous results
    resultsTbody.innerHTML = '';
    
    // Add rows to table
    organizations.forEach(org => {
        const row = document.createElement('tr');
        
        // Name column
        const nameCell = document.createElement('td');
        nameCell.textContent = org.name;
        row.appendChild(nameCell);
        
        // Type column
        const typeCell = document.createElement('td');
        const typeBadge = document.createElement('span');
        typeBadge.className = `type-badge ${getTypeBadgeClass(org.type)}`;
        typeBadge.textContent = org.type;
        typeCell.appendChild(typeBadge);
        row.appendChild(typeCell);
        
        // Website column
        const websiteCell = document.createElement('td');
        if (org.website) {
            const link = document.createElement('a');
            link.href = org.website;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'table-link';
            link.textContent = 'Visit Website';
            websiteCell.appendChild(link);
        } else {
            websiteCell.textContent = '-';
        }
        row.appendChild(websiteCell);
        
        // Contact column
        const contactCell = document.createElement('td');
        if (org.contact) {
            if (org.contact.includes('@')) {
                const emailLink = document.createElement('a');
                emailLink.href = `mailto:${org.contact}`;
                emailLink.className = 'table-link';
                emailLink.textContent = org.contact;
                contactCell.appendChild(emailLink);
            } else {
                contactCell.textContent = org.contact;
            }
        } else {
            contactCell.textContent = '-';
        }
        row.appendChild(contactCell);
        
        resultsTbody.appendChild(row);
    });
    
    tableContainer.style.display = 'block';
    downloadCsvBtn.disabled = false;
    
    // Reset sorting
    resetSortIndicators();
    
    console.log('Results displayed successfully');
}

function getTypeBadgeClass(type) {
    const typeMap = {
        'Museum': 'type-museum',
        'Historical Museum': 'type-museum',
        'Art Gallery': 'type-gallery',
        'Theatre': 'type-theatre',
        'Cinema': 'type-theatre',
        'Library': 'type-library',
        'Arts Centre': 'type-arts-centre',
        'Community Centre': 'type-arts-centre',
        'Cultural Centre': 'type-arts-centre'
    };
    
    return typeMap[type] || 'type-other';
}

function handleSort(column) {
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }
    
    // Sort the results
    const sortedResults = [...currentResults].sort((a, b) => {
        let aValue = a[column] || '';
        let bValue = b[column] || '';
        
        // Handle empty values
        if (!aValue && !bValue) return 0;
        if (!aValue) return 1;
        if (!bValue) return -1;
        
        // Convert to string for comparison
        aValue = String(aValue);
        bValue = String(bValue);
        
        // Compare values
        const comparison = aValue.localeCompare(bValue);
        return currentSortDirection === 'asc' ? comparison : -comparison;
    });
    
    // Update UI
    updateSortIndicators();
    displayResults(sortedResults);
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
        const indicator = header.querySelector('.sort-indicator');
        header.classList.remove('asc', 'desc');
        indicator.textContent = '↕';
    });
    currentSortColumn = null;
    currentSortDirection = 'asc';
}

function downloadCsv() {
    if (currentResults.length === 0) {
        return;
    }
    
    // Create CSV content
    const csvHeaders = ['Organization Name', 'Type', 'Website', 'Contact'];
    const csvRows = [csvHeaders.join(',')];
    
    currentResults.forEach(org => {
        const row = [
            escapeCsvValue(org.name),
            escapeCsvValue(org.type),
            escapeCsvValue(org.website),
            escapeCsvValue(org.contact)
        ];
        csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        
        // Generate filename with location and date
        const location = (locationInput?.value || 'search').replace(/[^a-zA-Z0-9]/g, '_');
        const date = new Date().toISOString().split('T')[0];
        link.setAttribute('download', `arts_organizations_${location}_${date}.csv`);
        
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        URL.revokeObjectURL(url);
    }
}

function escapeCsvValue(value) {
    if (!value) return '';
    
    // Convert to string and handle special characters
    const stringValue = String(value);
    
    // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    
    return stringValue;
}

function showLoading() {
    console.log('showLoading called');
    
    if (loadingContainer) {
        loadingContainer.style.display = 'flex';
    }
    if (tableContainer) {
        tableContainer.style.display = 'none';
    }
    if (searchBtn) {
        searchBtn.disabled = true;
        searchBtn.textContent = '🔍 Searching...';
    }
}

function hideLoading() {
    console.log('hideLoading called');
    
    if (loadingContainer) {
        loadingContainer.style.display = 'none';
    }
    if (searchBtn) {
        searchBtn.disabled = false;
        searchBtn.textContent = '🎨 Find Cultural Partners';
    }
}

function showError(message) {
    console.log('showError called:', message);
    
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
    if (tableContainer) {
        tableContainer.style.display = 'none';
    }
    if (downloadCsvBtn) {
        downloadCsvBtn.disabled = true;
    }
}

function hideError() {
    if (errorMessage) {
        errorMessage.style.display = 'none';
    }
}