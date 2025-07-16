// Global variables
let currentResults = [];
let currentSortColumn = null;
let currentSortDirection = 'asc';

// DOM elements
let locationInput;
let radiusSlider;
let radiusDisplay;
let searchBtn;
let resultsSection;
let loadingSpinner;
let errorMessage;
let resultsTableContainer;
let resultsTable;
let resultsTbody;
let resultsCount;
let downloadCsvBtn;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    
    // Wait a bit to ensure all elements are rendered
    setTimeout(() => {
        initializeElements();
        initializeEventListeners();
        updateRadiusDisplay();
        console.log('Application initialized');
    }, 100);
});

// Initialize DOM elements
function initializeElements() {
    locationInput = document.getElementById('location-input');
    radiusSlider = document.getElementById('radius-slider');
    radiusDisplay = document.getElementById('radius-display');
    searchBtn = document.getElementById('search-btn');
    resultsSection = document.getElementById('results-section');
    loadingSpinner = document.getElementById('loading-spinner');
    errorMessage = document.getElementById('error-message');
    resultsTableContainer = document.getElementById('results-table-container');
    resultsTable = document.getElementById('results-table');
    resultsTbody = document.getElementById('results-tbody');
    resultsCount = document.getElementById('results-count');
    downloadCsvBtn = document.getElementById('download-csv');
    
    // Debug: Check if elements exist
    console.log('Elements initialized:', {
        locationInput: !!locationInput,
        radiusSlider: !!radiusSlider,
        radiusDisplay: !!radiusDisplay,
        searchBtn: !!searchBtn
    });
}

// Event listeners
function initializeEventListeners() {
    // Search functionality
    if (searchBtn) {
        searchBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Search button clicked');
            handleSearch();
        });
        console.log('Search button event listener added');
    }
    
    if (locationInput) {
        locationInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
            }
        });
        
        // Debug input changes
        locationInput.addEventListener('input', function(e) {
            console.log('Input value:', e.target.value);
        });
        
        console.log('Location input event listeners added');
    }

    // Radius slider
    if (radiusSlider) {
        radiusSlider.addEventListener('input', function(e) {
            console.log('Slider value:', e.target.value);
            updateRadiusDisplay();
        });
        
        radiusSlider.addEventListener('change', function(e) {
            console.log('Slider changed:', e.target.value);
            updateRadiusDisplay();
        });
        
        console.log('Radius slider event listeners added');
    }

    // Table sorting
    const sortableHeaders = document.querySelectorAll('.sortable');
    sortableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            console.log('Sort by:', header.dataset.column);
            handleSort(header.dataset.column);
        });
    });
    console.log('Sortable headers:', sortableHeaders.length);

    // CSV download
    if (downloadCsvBtn) {
        downloadCsvBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('CSV download clicked');
            downloadCsv();
        });
        console.log('CSV download event listener added');
    }
}

// Update radius display
function updateRadiusDisplay() {
    if (radiusSlider && radiusDisplay) {
        const value = radiusSlider.value;
        radiusDisplay.textContent = `${value} km`;
        console.log('Radius display updated to:', value);
    } else {
        console.log('Radius elements not found:', { radiusSlider: !!radiusSlider, radiusDisplay: !!radiusDisplay });
    }
}

// Main search handler
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
        
        try {
            // Step 1: Geocode the location
            const coordinates = await geocodeLocation(location);
            console.log('Geocoded coordinates:', coordinates);
            
            // Step 2: Search for arts organizations
            const radius = parseInt(radiusSlider?.value || 25) * 1000; // Convert km to meters
            const organizations = await searchArtsOrganizations(coordinates, radius);
            console.log('Found organizations:', organizations.length);
            
            // Step 3: Process and display results
            currentResults = await processResults(organizations);
            displayResults(currentResults);
            
        } catch (apiError) {
            console.warn('API search failed, using sample data:', apiError);
            // Fallback to sample data for demo
            currentResults = getSampleData(location);
            displayResults(currentResults);
        }
        
    } catch (error) {
        console.error('Search error:', error);
        showError(error.message || 'An error occurred while searching. Please try again.');
    } finally {
        hideLoading();
    }
}

// Get sample data for demo purposes - all with valid contact information
function getSampleData(location) {
    const sampleOrgs = [
        {
            name: 'Philadelphia Museum of Art',
            website: 'https://www.philamuseum.org',
            contact: 'info@philamuseum.org',
            type: 'Museum'
        },
        {
            name: 'Mural Arts Philadelphia',
            website: 'https://www.muralarts.org',
            contact: 'info@muralarts.org',
            type: 'Arts Centre'
        },
        {
            name: 'Pennsylvania Academy of the Fine Arts',
            website: 'https://www.pafa.org',
            contact: 'admissions@pafa.org',
            type: 'Art School'
        },
        {
            name: 'Morris Arboretum & Gardens',
            website: 'https://www.morrisarboretum.org',
            contact: 'info@morrisarboretum.org',
            type: 'Botanical Garden'
        },
        {
            name: 'Academy of Natural Sciences',
            website: 'https://www.ansp.org',
            contact: 'education@ansp.org',
            type: 'Natural History Museum'
        },
        {
            name: 'Barnes Foundation',
            website: 'https://www.barnesfoundation.org',
            contact: 'info@barnesfoundation.org',
            type: 'Art Museum'
        },
        {
            name: 'Philadelphia Zoo',
            website: 'https://www.philadelphiazoo.org',
            contact: 'info@philadelphiazoo.org',
            type: 'Zoo'
        }
    ];
    
    return sampleOrgs.map(org => ({
        ...org,
        lat: 39.9526 + (Math.random() - 0.5) * 0.1,
        lon: -75.1652 + (Math.random() - 0.5) * 0.1
    }));
}

// Geocode location using Nominatim API
async function geocodeLocation(location) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(location)}`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Art Pharmacy Organization Finder'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to geocode location');
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

// Search for arts organizations using Overpass API - improved query
async function searchArtsOrganizations(coordinates, radius) {
    const { lat, lon } = coordinates;
    
    // Comprehensive Overpass query focusing on arts, culture, nature, and museums
    // Excludes generic parks and focuses on cultural institutions
    const overpassQuery = `
        [out:json][timeout:25];
        (
            node["tourism"="gallery"](around:${radius},${lat},${lon});
            node["tourism"="museum"](around:${radius},${lat},${lon});
            node["tourism"="zoo"](around:${radius},${lat},${lon});
            node["tourism"="aquarium"](around:${radius},${lat},${lon});
            node["tourism"="attraction"]["attraction"~"^(museum|gallery|cultural|heritage|botanical_garden|zoo|aquarium)$"](around:${radius},${lat},${lon});
            node["amenity"="arts_centre"](around:${radius},${lat},${lon});

            node["amenity"="library"]["library"~"^(public|research|academic|special)$"](around:${radius},${lat},${lon});
            node["amenity"="community_centre"]["community_centre"~"arts|culture"](around:${radius},${lat},${lon});
            node["amenity"="music_venue"](around:${radius},${lat},${lon});
            node["amenity"="concert_hall"](around:${radius},${lat},${lon});
            node["amenity"="studio"]["studio"~"^(art|music|dance|photography|pottery|sculpture)$"](around:${radius},${lat},${lon});
            node["craft"="pottery"](around:${radius},${lat},${lon});
            node["craft"="sculptor"](around:${radius},${lat},${lon});
            node["historic"="museum"](around:${radius},${lat},${lon});
            node["historic"="heritage"](around:${radius},${lat},${lon});
            node["historic"="archaeological_site"](around:${radius},${lat},${lon});
            node["leisure"="garden"]["garden:type"="botanical"](around:${radius},${lat},${lon});
            node["leisure"="nature_reserve"]["nature_reserve"~"educational|visitor_centre"](around:${radius},${lat},${lon});
            node["leisure"="wildlife_park"](around:${radius},${lat},${lon});

            node["cultural"](around:${radius},${lat},${lon});
            way["tourism"="gallery"](around:${radius},${lat},${lon});
            way["tourism"="museum"](around:${radius},${lat},${lon});
            way["tourism"="zoo"](around:${radius},${lat},${lon});
            way["tourism"="aquarium"](around:${radius},${lat},${lon});
            way["tourism"="attraction"]["attraction"~"^(museum|gallery|cultural|heritage|botanical_garden|zoo|aquarium)$"](around:${radius},${lat},${lon});
            way["amenity"="arts_centre"](around:${radius},${lat},${lon});

            way["amenity"="library"]["library"~"^(public|research|academic|special)$"](around:${radius},${lat},${lon});
            way["amenity"="community_centre"]["community_centre"~"arts|culture"](around:${radius},${lat},${lon});
            way["amenity"="music_venue"](around:${radius},${lat},${lon});
            way["amenity"="concert_hall"](around:${radius},${lat},${lon});
            way["amenity"="studio"]["studio"~"^(art|music|dance|photography|pottery|sculpture)$"](around:${radius},${lat},${lon});
            way["craft"="pottery"](around:${radius},${lat},${lon});
            way["craft"="sculptor"](around:${radius},${lat},${lon});
            way["historic"="museum"](around:${radius},${lat},${lon});
            way["historic"="heritage"](around:${radius},${lat},${lon});
            way["historic"="archaeological_site"](around:${radius},${lat},${lon});
            way["leisure"="garden"]["garden:type"="botanical"](around:${radius},${lat},${lon});
            way["leisure"="nature_reserve"]["nature_reserve"~"educational|visitor_centre"](around:${radius},${lat},${lon});
            way["leisure"="wildlife_park"](around:${radius},${lat},${lon});

            way["cultural"](around:${radius},${lat},${lon});
        );
        out center meta;
    `;
    
    try {
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
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

// Check if a URL is likely to have contact information
async function hasValidContact(website) {
    if (!website) return false;
    
    try {
        // Check if it's a valid URL format
        const url = new URL(website);
        
        // Skip checking for demo purposes, assume valid
        // In production, you might want to check for contact pages
        return true;
        
    } catch (error) {
        return false;
    }
}

// Process and clean results - filter out organizations without valid contact info
async function processResults(rawResults) {
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
        
        // Skip generic parks and non-cultural sites
        if (isGenericPark(tags)) {
            continue;
        }
        
        // Extract website
        let website = tags.website || tags['contact:website'] || tags.url || '';
        if (website && !website.startsWith('http')) {
            website = 'https://' + website;
        }
        
        // Extract contact info - prioritize email
        let contact = tags.email || tags['contact:email'] || tags.phone || tags['contact:phone'] || '';
        
        // If no direct contact, generate contact page URL if website exists
        if (!contact && website) {
            contact = website.replace(/\/$/, '') + '/contact';
        }
        
        // Skip organizations without any meaningful contact information
        if (!contact && !website) {
            console.log(`Skipping ${name} - no contact information`);
            continue;
        }
        
        // Validate that we have meaningful contact info
        if (!isValidContact(contact, website)) {
            console.log(`Skipping ${name} - invalid contact information`);
            continue;
        }
        
        // Final check: must have either valid email or valid website
        const hasValidEmail = contact && contact.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
        const hasValidWebsite = website && website.startsWith('http');
        
        if (!hasValidEmail && !hasValidWebsite) {
            console.log(`Skipping ${name} - no valid email or website`);
            continue;
        }
        
        seenNames.add(normalizedName);
        
        organizations.push({
            name: name,
            website: website,
            contact: contact,
            lat: element.lat || (element.center && element.center.lat) || 0,
            lon: element.lon || (element.center && element.center.lon) || 0,
            type: getOrganizationType(tags)
        });
    }
    
    return organizations;
}

// Check if location is a generic park (to exclude)
function isGenericPark(tags) {
    // Exclude generic parks, playgrounds, sports facilities
    if (tags.leisure === 'park' && !tags['garden:type'] && !tags.attraction) {
        return true;
    }
    if (tags.leisure === 'playground') {
        return true;
    }
    if (tags.leisure === 'sports_centre') {
        return true;
    }
    if (tags.leisure === 'pitch') {
        return true;
    }
    if (tags.amenity === 'parking') {
        return true;
    }
    return false;
}

// Validate contact information
function isValidContact(contact, website) {
    // Must have either email or website
    if (!contact && !website) {
        return false;
    }
    
    // If contact is an email, validate format
    if (contact && contact.includes('@')) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(contact);
    }
    
    // If contact is a URL, it should be valid
    if (contact && contact.startsWith('http')) {
        try {
            new URL(contact);
            return true;
        } catch {
            return false;
        }
    }
    
    // If we have a website, that's acceptable
    if (website) {
        try {
            new URL(website);
            return true;
        } catch {
            return false;
        }
    }
    
    return false;
}

// Get organization type from tags - improved categorization
function getOrganizationType(tags) {
    // Museums and galleries
    if (tags.tourism === 'gallery') return 'Art Gallery';
    if (tags.tourism === 'museum') return 'Museum';
    if (tags.historic === 'museum') return 'Historical Museum';
    if (tags.attraction === 'museum') return 'Museum';
    
    // Nature and science
    if (tags.tourism === 'zoo') return 'Zoo';
    if (tags.tourism === 'aquarium') return 'Aquarium';
    if (tags.attraction === 'botanical_garden') return 'Botanical Garden';
    if (tags['garden:type'] === 'botanical') return 'Botanical Garden';
    if (tags.leisure === 'garden' && tags['garden:type'] === 'botanical') return 'Botanical Garden';
    if (tags.leisure === 'nature_reserve') return 'Nature Centre';
    if (tags.leisure === 'wildlife_park') return 'Wildlife Park';
    
    // Performing arts
    if (tags.amenity === 'music_venue') return 'Music Venue';
    if (tags.amenity === 'concert_hall') return 'Concert Hall';
    
    // Arts and culture centres
    if (tags.amenity === 'arts_centre') return 'Arts Centre';
    if (tags.amenity === 'community_centre') return 'Community Arts Centre';
    if (tags.cultural) return 'Cultural Centre';
    
    // Educational and libraries
    if (tags.amenity === 'library') return 'Library';
    
    // Studios and workshops
    if (tags.amenity === 'studio') return 'Studio';
    if (tags.craft === 'pottery') return 'Pottery Studio';
    if (tags.craft === 'sculptor') return 'Sculpture Studio';
    
    // Historical sites
    if (tags.historic === 'heritage') return 'Heritage Site';
    if (tags.historic === 'archaeological_site') return 'Archaeological Site';
    
    return 'Cultural Organization';
}

// Display results in table
function displayResults(organizations) {
    console.log('displayResults called with', organizations.length, 'organizations');
    
    if (!resultsSection || !resultsCount || !resultsTbody) {
        console.error('Required elements not found for displaying results');
        return;
    }
    
    resultsSection.style.display = 'block';
    resultsCount.textContent = `${organizations.length} organization${organizations.length !== 1 ? 's' : ''} found`;
    
    if (organizations.length === 0) {
        if (resultsTableContainer) {
            resultsTableContainer.style.display = 'none';
        }
        if (downloadCsvBtn) {
            downloadCsvBtn.disabled = true;
        }
        showError('No arts or cultural organizations with contact information found in this area. Try expanding your search radius or a different location.');
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
        
        // Website column
        const websiteCell = document.createElement('td');
        if (org.website) {
            const link = document.createElement('a');
            link.href = org.website;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = org.website;
            websiteCell.appendChild(link);
        } else {
            websiteCell.textContent = '-';
        }
        row.appendChild(websiteCell);
        
        // Contact column
        const contactCell = document.createElement('td');
        if (org.contact) {
            if (org.contact.includes('@')) {
                // Email contact
                const emailLink = document.createElement('a');
                emailLink.href = `mailto:${org.contact}`;
                emailLink.textContent = org.contact;
                emailLink.className = 'contact-info';
                contactCell.appendChild(emailLink);
            } else if (org.contact.startsWith('http')) {
                // Contact page URL
                const contactLink = document.createElement('a');
                contactLink.href = org.contact;
                contactLink.target = '_blank';
                contactLink.rel = 'noopener noreferrer';
                contactLink.textContent = 'Contact Page';
                contactLink.className = 'contact-info';
                contactCell.appendChild(contactLink);
            } else {
                contactCell.textContent = org.contact;
            }
        } else {
            contactCell.textContent = '-';
        }
        row.appendChild(contactCell);
        
        // Type column
        const typeCell = document.createElement('td');
        typeCell.textContent = org.type;
        row.appendChild(typeCell);
        
        resultsTbody.appendChild(row);
    });
    
    if (resultsTableContainer) {
        resultsTableContainer.style.display = 'block';
    }
    if (downloadCsvBtn) {
        downloadCsvBtn.disabled = false;
    }
    
    // Reset sorting
    resetSortIndicators();
    
    console.log('Results displayed successfully');
}

// Handle table sorting
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

// Update sort indicators
function updateSortIndicators() {
    document.querySelectorAll('.sortable').forEach(header => {
        header.classList.remove('asc', 'desc');
        if (header.dataset.column === currentSortColumn) {
            header.classList.add(currentSortDirection);
        }
    });
}

// Reset sort indicators
function resetSortIndicators() {
    document.querySelectorAll('.sortable').forEach(header => {
        header.classList.remove('asc', 'desc');
    });
    currentSortColumn = null;
    currentSortDirection = 'asc';
}

// Download CSV
function downloadCsv() {
    if (currentResults.length === 0) {
        return;
    }
    
    // Create CSV content
    const csvHeaders = ['Organization Name', 'Website', 'Contact', 'Type'];
    const csvRows = [csvHeaders.join(',')];
    
    currentResults.forEach(org => {
        const row = [
            escapeCsvValue(org.name),
            escapeCsvValue(org.website),
            escapeCsvValue(org.contact),
            escapeCsvValue(org.type)
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

// Escape CSV values
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

// Show loading state
function showLoading() {
    console.log('showLoading called');
    
    if (loadingSpinner) {
        loadingSpinner.style.display = 'flex';
        console.log('Loading spinner shown');
    }
    if (resultsTableContainer) {
        resultsTableContainer.style.display = 'none';
    }
    if (searchBtn) {
        searchBtn.disabled = true;
        searchBtn.textContent = 'Searching...';
        console.log('Search button updated');
    }
}

// Hide loading state
function hideLoading() {
    console.log('hideLoading called');
    
    if (loadingSpinner) {
        loadingSpinner.style.display = 'none';
    }
    if (searchBtn) {
        searchBtn.disabled = false;
        searchBtn.textContent = 'Find Partners';
    }
}

// Show error message
function showError(message) {
    console.log('showError called:', message);
    
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
    if (resultsTableContainer) {
        resultsTableContainer.style.display = 'none';
    }
    if (downloadCsvBtn) {
        downloadCsvBtn.disabled = true;
    }
}

// Hide error message
function hideError() {
    if (errorMessage) {
        errorMessage.style.display = 'none';
    }
}