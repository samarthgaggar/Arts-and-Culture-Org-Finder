// Global variables
let currentResults = [];
let currentSortColumn = null;
let currentSortDirection = 'asc';
let elements = {}; // Store all DOM elements

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
    // Search
    elements.searchBtn?.addEventListener('click', handleSearch);
    elements.locationInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    // Slider - multiple approaches for reliability
    if (elements.radiusSlider) {
        elements.radiusSlider.addEventListener('input', updateRadiusDisplay);
        elements.radiusSlider.addEventListener('change', updateRadiusDisplay);
        elements.radiusSlider.addEventListener('mousemove', (e) => {
            if (e.buttons === 1) updateRadiusDisplay();
        });
    }
    
    // Event delegation backup for slider
    document.addEventListener('input', (e) => {
        if (e.target?.id === 'radius-slider') updateRadiusDisplay();
    });

    // Table sorting
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => handleSort(header.dataset.column));
    });

    // CSV download
    elements.downloadCsvBtn?.addEventListener('click', downloadCsv);
}

function updateRadiusDisplay() {
    const slider = elements.radiusSlider || document.getElementById('radius-slider');
    const display = elements.radiusDisplay || document.getElementById('radius-display');
    
    if (slider && display) {
        const value = slider.value;
        display.textContent = `${value} km`;
        console.log('Slider updated:', value);
    }
}

async function handleSearch() {
    const location = elements.locationInput?.value?.trim();
    if (!location) {
        showError('Please enter a location to search.');
        return;
    }

    try {
        showLoading();
        hideError();
        
        const coordinates = await geocodeLocation(location);
        const radius = parseInt(elements.radiusSlider?.value || 25) * 1000;
        const organizations = await searchArtsOrganizations(coordinates, radius);
        currentResults = await enhanceResults(organizations, location);
        displayResults(currentResults);
        
    } catch (error) {
        console.error('Search error:', error);
        showError(error.message || 'Search failed. Please try again.');
    } finally {
        hideLoading();
    }
}

async function geocodeLocation(location) {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(location)}`, {
        headers: { 'User-Agent': 'Art-Pharmacy-Finder/1.0' }
    });
    
    if (!response.ok) throw new Error('Failed to find location');
    
    const data = await response.json();
    if (data.length === 0) throw new Error('Location not found. Please try a different location.');
    
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

async function searchArtsOrganizations({ lat, lon }, radius) {
    const query = `
        [out:json][timeout:30];
        (
            node["tourism"~"^(gallery|museum)$|artwork"](around:${radius},${lat},${lon});
            way["tourism"~"^(gallery|museum)$|artwork"](around:${radius},${lat},${lon});
            node["amenity"~"^(arts_centre|community_centre|cultural_centre|theatre|music_venue|concert_hall|opera|library|university|college)$"](around:${radius},${lat},${lon});
            way["amenity"~"^(arts_centre|community_centre|cultural_centre|theatre|music_venue|concert_hall|opera|library|university|college)$"](around:${radius},${lat},${lon});
            node["historic"~"^(museum|heritage|castle|monument|archaeological_site|memorial)$"](around:${radius},${lat},${lon});
            way["historic"~"^(museum|heritage|castle|monument|archaeological_site|memorial)$"](around:${radius},${lat},${lon});
            node["leisure"="garden"]["garden:type"="botanical"](around:${radius},${lat},${lon});
            way["leisure"="garden"]["garden:type"="botanical"](around:${radius},${lat},${lon});
            node["tourism"~"^(zoo|aquarium)$"](around:${radius},${lat},${lon});
            way["tourism"~"^(zoo|aquarium)$"](around:${radius},${lat},${lon});
            node["craft"~"^(pottery|artist|sculptor)$"][!"shop"](around:${radius},${lat},${lon});
            way["craft"~"^(pottery|artist|sculptor)$"][!"shop"](around:${radius},${lat},${lon});
        );
        out center meta;
    `;
    
    await sleep(500);
    
    const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`
    });
    
    if (!response.ok) throw new Error('Search failed');
    const data = await response.json();
    return data.elements || [];
}

function processResults(rawResults) {
    const organizations = [];
    const seen = new Set();
    
    rawResults.forEach(element => {
        const tags = element.tags || {};
        const name = tags.name || tags['name:en'] || 'Unnamed Organization';
        const key = name.toLowerCase().trim();
        
        if (seen.has(key) || isExcluded(tags, name)) return;
        seen.add(key);
        
        let website = tags.website || tags['contact:website'] || tags.url || '';
        if (website && !website.startsWith('http')) website = 'https://' + website;
        
        const contact = tags.email || tags['contact:email'] || tags.phone || tags['contact:phone'] || '';
        
        organizations.push({
            name,
            website,
            contact,
            contactType: contact.includes('@') ? 'email' : contact.match(/[\d\-\(\)\+\s]{7,}/) ? 'phone' : '',
            lat: element.lat || element.center?.lat || 0,
            lon: element.lon || element.center?.lon || 0,
            type: getOrgType(tags)
        });
    });
    
    return organizations;
}

function isExcluded(tags, name) {
    const excluded = ['parking', 'toilets', 'shop', 'retail', 'cinema', 'restaurant', 'cafe', 'bar'];
    if (excluded.some(tag => tags[tag] || tags.amenity === tag)) return true;
    
    const commercial = ['shop', 'store', 'boutique', 'market', 'mall'];
    if (commercial.some(word => name.toLowerCase().includes(word))) return true;
    
    return tags.access === 'private' || (tags.fee === 'yes' && !isMajorVenue(tags));
}

function isMajorVenue(tags) {
    const major = ['museum', 'gallery', 'zoo', 'aquarium', 'theatre', 'opera', 'castle'];
    return major.some(type => Object.values(tags).includes(type));
}

function getOrgType(tags) {
    const types = {
        gallery: 'Art Gallery', museum: 'Museum', theatre: 'Theatre',
        music_venue: 'Music Venue', concert_hall: 'Concert Hall', opera: 'Opera House',
        arts_centre: 'Arts Centre', community_centre: 'Community Centre',
        cultural_centre: 'Cultural Centre', library: 'Library',
        university: 'University', college: 'College', zoo: 'Zoo', aquarium: 'Aquarium'
    };
    
    for (const [key, value] of Object.entries(types)) {
        if (Object.values(tags).includes(key)) return value;
    }
    
    if (tags.historic === 'castle') return 'Historic Castle';
    if (tags.historic === 'monument') return 'Monument';
    if (tags.historic === 'heritage') return 'Heritage Site';
    if (tags.tourism === 'artwork') return 'Public Art';
    if (tags.leisure === 'garden') return 'Botanical Garden';
    
    return 'Cultural Organization';
}

async function enhanceResults(rawResults, location) {
    const organizations = processResults(rawResults);
    
    for (let i = 0; i < Math.min(organizations.length, 25); i++) {
        const org = organizations[i];
        console.log(`Enhancing ${i + 1}/${organizations.length}: ${org.name}`);
        
        if (!org.website) {
            const sites = await findWebsites(org.name, location, org.type);
            if (sites.length > 0) {
                org.website = sites[0];
                org.allWebsites = sites;
            }
        }
        
        if (!org.contact) {
            const contact = await findContact(org.name, location, org.allWebsites || []);
            if (contact) {
                org.contact = contact.value;
                org.contactType = contact.type;
            }
        }
        
        await sleep(150);
    }
    
    return organizations;
}

async function findWebsites(name, location, type) {
    const queries = [
        `"${name}" ${location} official website`,
        `${name.replace(/[^\w\s]/g, '')} ${type} site`,
        `${name} cultural organization`
    ];
    
    for (const query of queries) {
        try {
            const sites = await searchWeb(query, name);
            if (sites.length > 0) return sites.slice(0, 2);
            await sleep(200);
        } catch (e) { continue; }
    }
    
    return [];
}

async function findContact(name, location, websites) {
    // Try email search
    const emailQueries = [`"${name}" ${location} email`, `${name} contact email`];
    for (const query of emailQueries) {
        try {
            const email = await searchEmail(query);
            if (email && isValidEmail(email)) return { value: email, type: 'email' };
            await sleep(150);
        } catch (e) { continue; }
    }
    
    // Try contact page
    if (websites?.length > 0) {
        const contactPage = await findContactPage(websites[0]);
        if (contactPage) return { value: contactPage, type: 'contactPage' };
    }
    
    // Generate email
    if (websites?.length > 0) {
        try {
            const domain = new URL(websites[0]).hostname;
            return { value: `info@${domain}`, type: 'email' };
        } catch (e) { }
    }
    
    return null;
}

async function searchWeb(query, orgName) {
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`);
    const data = await response.json();
    
    const sites = [];
    if (data.AbstractURL && isValidSite(data.AbstractURL, orgName)) sites.push(data.AbstractURL);
    
    data.Results?.slice(0, 3).forEach(result => {
        if (result.FirstURL && isValidSite(result.FirstURL, orgName)) sites.push(result.FirstURL);
    });
    
    return [...new Set(sites)];
}

async function searchEmail(query) {
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`);
    const data = await response.json();
    
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    
    const text = data.Abstract + (data.Results?.map(r => r.Text).join(' ') || '');
    const match = text.match(emailRegex);
    return match?.[0] || null;
}

async function findContactPage(website) {
    const paths = ['/contact', '/contact-us', '/about/contact', '/info/contact'];
    
    for (const path of paths) {
        try {
            const url = website.endsWith('/') ? website + path.substring(1) : website + path;
            const controller = new AbortController();
            setTimeout(() => controller.abort(), 1500);
            
            await fetch(url, { method: 'HEAD', signal: controller.signal, mode: 'no-cors' });
            return url;
        } catch (e) { continue; }
    }
    
    return null;
}

function isValidSite(url, name) {
    try {
        const domain = new URL(url).hostname.toLowerCase();
        const skip = ['facebook', 'twitter', 'instagram', 'yelp', 'wikipedia', 'google'];
        if (skip.some(s => domain.includes(s))) return false;
        
        const good = ['.org', '.edu', '.gov', '.museum'];
        return good.some(g => domain.endsWith(g)) || domain.includes('museum') || domain.includes('arts');
    } catch (e) { return false; }
}

function isValidEmail(email) {
    return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/.test(email) &&
           !email.includes('example.com') && !email.includes('noreply');
}

function displayResults(organizations) {
    if (!elements.resultsSection) return;
    
    elements.resultsSection.style.display = 'block';
    elements.resultsCount.textContent = `${organizations.length} organization${organizations.length !== 1 ? 's' : ''} found`;
    
    if (organizations.length === 0) {
        elements.tableContainer.style.display = 'none';
        elements.downloadCsvBtn.disabled = true;
        showError('No cultural organizations found. Try expanding your search radius.');
        return;
    }
    
    elements.resultsTbody.innerHTML = '';
    
    organizations.forEach(org => {
        const row = document.createElement('tr');
        
        // Name
        row.appendChild(createCell(org.name));
        
        // Website
        const websiteCell = document.createElement('td');
        if (org.allWebsites?.length > 0) {
            org.allWebsites.forEach((site, i) => {
                if (i > 0) websiteCell.appendChild(document.createElement('br'));
                websiteCell.appendChild(createLink(site, i === 0 ? 'Main Site' : `Site ${i + 1}`));
            });
        } else if (org.website) {
            websiteCell.appendChild(createLink(org.website, 'Visit Website'));
        } else {
            websiteCell.textContent = '-';
        }
        row.appendChild(websiteCell);
        
        // Contact
        const contactCell = document.createElement('td');
        if (org.contact) {
            if (org.contactType === 'email' || org.contact.includes('@')) {
                contactCell.appendChild(createLink(`mailto:${org.contact}`, org.contact));
            } else if (org.contact.startsWith('http')) {
                contactCell.appendChild(createLink(org.contact, 'Contact Page', true));
            } else if (org.contact.match(/[\d\s\-\(\)\+\.]{7,}/)) {
                contactCell.appendChild(createLink(`tel:${org.contact.replace(/[^\d\+]/g, '')}`, org.contact));
            } else {
                contactCell.textContent = org.contact;
            }
        } else {
            contactCell.textContent = '-';
        }
        row.appendChild(contactCell);
        
        // Type
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

function createCell(text) {
    const cell = document.createElement('td');
    cell.textContent = text;
    return cell;
}

function createLink(href, text, newTab = true) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = text;
    link.className = 'table-link';
    if (newTab) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
    }
    return link;
}

function getBadgeClass(type) {
    const map = {
        'Museum': 'type-museum', 'Art Gallery': 'type-gallery',
        'Theatre': 'type-theatre', 'Library': 'type-library',
        'Arts Centre': 'type-arts-centre'
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
        const aVal = String(a[column] || '');
        const bVal = String(b[column] || '');
        const comparison = aVal.localeCompare(bVal);
        return currentSortDirection === 'asc' ? comparison : -comparison;
    });
    
    updateSortIndicators();
    displayResults(sorted);
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
    
    const headers = ['Organization Name', 'Website', 'Contact', 'Type'];
    const rows = [headers.join(',')];
    
    currentResults.forEach(org => {
        const row = [
            escapeCsv(org.name),
            escapeCsv(org.website),
            escapeCsv(org.contact),
            escapeCsv(org.type)
        ];
        rows.push(row.join(','));
    });
    
    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `arts_organizations_${Date.now()}.csv`;
    link.click();
    
    URL.revokeObjectURL(url);
}

function escapeCsv(value) {
    if (!value) return '';
    const str = String(value);
    return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
}

function showLoading() {
    elements.loadingContainer.style.display = 'flex';
    elements.tableContainer.style.display = 'none';
    elements.searchBtn.disabled = true;
    elements.searchBtn.textContent = '🔍 Searching...';
    
    const text = elements.loadingContainer.querySelector('.loading-text');
    if (text) text.textContent = 'Finding cultural organizations...';
}

function hideLoading() {
    elements.loadingContainer.style.display = 'none';
    elements.searchBtn.disabled = false;
    elements.searchBtn.textContent = 'Find Partners';
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.style.display = 'block';
    elements.tableContainer.style.display = 'none';
    elements.downloadCsvBtn.disabled = true;
}

function hideError() {
    elements.errorMessage.style.display = 'none';
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}