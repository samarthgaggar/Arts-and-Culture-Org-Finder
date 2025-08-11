// Global variables
let currentResults = [];
let currentSortColumn = null;
let currentSortDirection = 'asc';
let elements = {};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing...');
    initializeApp();
});

function initializeApp() {
    console.log('Getting elements...');
    
    // Get DOM elements
    elements.locationInput = document.getElementById('location-input');
    elements.searchBtn = document.getElementById('search-btn');
    elements.radiusSlider = document.getElementById('radius-slider');
    elements.radiusDisplay = document.getElementById('radius-display');
    elements.resultsSection = document.getElementById('results-section');
    elements.loadingContainer = document.getElementById('loading-container');
    elements.errorMessage = document.getElementById('error-message');
    elements.tableContainer = document.getElementById('table-container');
    elements.resultsTbody = document.getElementById('results-tbody');
    elements.resultsCount = document.getElementById('results-count');
    elements.downloadCsvBtn = document.getElementById('download-csv');

    console.log('Elements found:', {
        searchBtn: !!elements.searchBtn,
        locationInput: !!elements.locationInput,
        radiusSlider: !!elements.radiusSlider
    });

    setupEventListeners();
    updateRadiusDisplay();
    
    console.log('App initialized successfully');
}

function setupEventListeners() {
    // Search button
    if (elements.searchBtn) {
        console.log('Setting up search button listener');
        elements.searchBtn.addEventListener('click', function(e) {
            console.log('Search button clicked');
            e.preventDefault();
            handleSearch();
        });
    }
    
    // Enter key on location input
    if (elements.locationInput) {
        elements.locationInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                console.log('Enter key pressed');
                e.preventDefault();
                handleSearch();
            }
        });
    }

    // Radius slider
    if (elements.radiusSlider) {
        elements.radiusSlider.addEventListener('input', updateRadiusDisplay);
        elements.radiusSlider.addEventListener('change', updateRadiusDisplay);
    }

    // Download CSV button
    if (elements.downloadCsvBtn) {
        elements.downloadCsvBtn.addEventListener('click', downloadCsv);
    }
}

function setupSortableHeaders() {
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => handleSort(header.dataset.column));
    });
}

function updateRadiusDisplay() {
    if (elements.radiusSlider && elements.radiusDisplay) {
        const value = elements.radiusSlider.value;
        elements.radiusDisplay.textContent = `${value} km`;
    }
}

async function handleSearch() {
    console.log('handleSearch called');
    
    const location = elements.locationInput?.value?.trim();
    console.log('Location input:', location);
    
    if (!location) {
        console.log('No location provided');
        showError('Please enter a location to search.');
        return;
    }

    try {
        showLoading('Finding location...');
        hideError();
        
        console.log('Starting geocoding...');
        const coords = await geocodeLocation(location);
        console.log('Location found:', coords);
        
        updateLoadingMessage('Searching for cultural, wellness, and nature organizations...');
        const radius = parseInt(elements.radiusSlider?.value || 25) * 1000;
        console.log('Search radius:', radius);
        
        const organizations = await searchCulturalOrganizations(coords, radius);
        console.log(`Found ${organizations.length} organizations`);
        
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

// Fast contact page finder using CORS proxy
async function findContactPageFast(website) {
    if (!website) return '';
    
    const baseUrl = website.startsWith('http') ? website : `https://${website}`;
    
    try {
        // Use AllOrigins CORS proxy to fetch the page content
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(baseUrl)}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 second timeout
        
        const response = await fetch(proxyUrl, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error('Failed to fetch page');
        }
        
        const data = await response.json();
        const htmlContent = data.contents;
        
        if (!htmlContent) {
            throw new Error('No content received');
        }
        
        // Parse HTML and find contact links
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        
        // Look for contact links with various strategies
        const contactUrl = findContactLinkInHTML(doc, baseUrl);
        
        return contactUrl;
        
    } catch (error) {
        console.warn('Error fetching contact page for', website, ':', error.message);
        return '';
    }
}

// Smart contact link finder in HTML
function findContactLinkInHTML(doc, baseUrl) {
    try {
        const urlObj = new URL(baseUrl);
        const domain = urlObj.origin;
        
        // Strategy 1: Look for navigation links with contact keywords
        const navSelectors = [
            'nav a', 'header a', '.menu a', '.navigation a', 
            '.navbar a', '.nav a', '.main-nav a', '.primary-nav a'
        ];
        
        for (const selector of navSelectors) {
            const links = doc.querySelectorAll(selector);
            for (const link of links) {
                const text = link.textContent?.trim().toLowerCase() || '';
                const href = link.getAttribute('href');
                
                if (!href) continue;
                
                // Check for contact-related text
                if (text.includes('contact') || text.includes('reach') || 
                    text.includes('touch') || text.includes('connect')) {
                    
                    const fullUrl = makeAbsoluteUrl(href, domain);
                    if (fullUrl && isValidContactUrl(fullUrl, text)) {
                        return fullUrl;
                    }
                }
            }
        }
        
        // Strategy 2: Look for any links with contact in href
        const allLinks = doc.querySelectorAll('a[href*="contact"], a[href*="Contact"]');
        for (const link of allLinks) {
            const href = link.getAttribute('href');
            const text = link.textContent?.trim().toLowerCase() || '';
            
            if (href) {
                const fullUrl = makeAbsoluteUrl(href, domain);
                if (fullUrl && isValidContactUrl(fullUrl, text)) {
                    return fullUrl;
                }
            }
        }
        
        // Strategy 3: Look for footer contact links
        const footerSelectors = ['footer a', '.footer a', '.site-footer a'];
        for (const selector of footerSelectors) {
            const links = doc.querySelectorAll(selector);
            for (const link of links) {
                const text = link.textContent?.trim().toLowerCase() || '';
                const href = link.getAttribute('href');
                
                if (!href) continue;
                
                if (text.includes('contact')) {
                    const fullUrl = makeAbsoluteUrl(href, domain);
                    if (fullUrl && isValidContactUrl(fullUrl, text)) {
                        return fullUrl;
                    }
                }
            }
        }
        
        return '';
        
    } catch (error) {
        console.warn('Error parsing HTML for contact links:', error);
        return '';
    }
}

// Convert relative URLs to absolute URLs
function makeAbsoluteUrl(href, domain) {
    try {
        if (href.startsWith('http')) {
            return href;
        } else if (href.startsWith('/')) {
            return domain + href;
        } else if (href.startsWith('./')) {
            return domain + '/' + href.substring(2);
        } else if (!href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
            return domain + '/' + href;
        }
        return '';
    } catch (error) {
        return '';
    }
}

// Validate if this looks like a real contact URL
function isValidContactUrl(url, linkText) {
    try {
        const urlObj = new URL(url);
        const path = urlObj.pathname.toLowerCase();
        const text = linkText.toLowerCase();
        
        // Exclude non-contact links
        if (text.includes('contractor') || text.includes('contracts') || 
            text.includes('contact lens') || text.includes('contact sport')) {
            return false;
        }
        
        // Must contain contact-related terms
        return path.includes('contact') || text.includes('contact') || 
               text.includes('reach') || text.includes('touch') || text.includes('connect');
               
    } catch {
        return false;
    }
}

// Fast batch processing with concurrent requests
async function processContactPagesFast(organizations) {
    const orgsWithWebsites = organizations.filter(org => org.website && !org.contactPage);
    
    if (orgsWithWebsites.length === 0) {
        return organizations;
    }
    
    console.log(`Finding contact pages for ${orgsWithWebsites.length} organizations...`);
    updateLoadingMessage(`Finding contact pages... (0/${orgsWithWebsites.length})`);
    
    // Process in larger concurrent batches for speed
    const batchSize = 8;
    let processed = 0;
    
    for (let i = 0; i < orgsWithWebsites.length; i += batchSize) {
        const batch = orgsWithWebsites.slice(i, i + batchSize);
        
        // Process batch concurrently
        const promises = batch.map(async (org) => {
            try {
                const contactPage = await findContactPageFast(org.website);
                if (contactPage) {
                    org.contactPage = contactPage;
                    console.log(`Found contact page for ${org.name}: ${contactPage}`);
                }
            } catch (error) {
                console.warn(`Failed to find contact for ${org.name}:`, error.message);
            }
            return org;
        });
        
        await Promise.allSettled(promises);
        
        processed += batch.length;
        updateLoadingMessage(`Finding contact pages... (${processed}/${orgsWithWebsites.length})`);
        
        // Small delay between batches to be respectful
        if (i + batchSize < orgsWithWebsites.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    return organizations;
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

            // Botanical gardens and specialized gardens
            node["leisure"="botanical_garden"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["leisure"="botanical_garden"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["garden:type"="botanical"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["garden:type"="botanical"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["garden:type"="rose"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["garden:type"="rose"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["garden:type"="japanese"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["garden:type"="japanese"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["garden:type"="herb"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["garden:type"="herb"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["garden:type"="sculpture"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["garden:type"="sculpture"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["leisure"="garden"]["garden:type"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["leisure"="garden"]["garden:type"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            // Nature centers and wildlife facilities
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
            
            node["leisure"="wildlife_hide"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["leisure"="wildlife_hide"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            // Arboretums and tree collections
            node["landuse"="arboretum"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["landuse"="arboretum"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["leisure"="arboretum"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["leisure"="arboretum"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            // Conservatories and greenhouses
            node["building"="conservatory"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["building"="conservatory"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["greenhouse"="yes"]["tourism"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["greenhouse"="yes"]["tourism"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            // Managed parks with facilities
            node["leisure"="park"]["operator"]["website"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["leisure"="park"]["operator"]["website"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["leisure"="park"]["tourism"="attraction"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["leisure"="park"]["tourism"="attraction"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            // Environmental education centers
            node["amenity"="education_centre"]["education:type"="environmental"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["amenity"="education_centre"]["education:type"="environmental"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["amenity"="education_centre"]["education:type"="nature"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["amenity"="education_centre"]["education:type"="nature"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            // Observatory and planetarium
            node["man_made"="observatory"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["man_made"="observatory"](around:${radiusMeters},${coords.lat},${coords.lon});
            
            node["amenity"="planetarium"](around:${radiusMeters},${coords.lat},${coords.lon});
            way["amenity"="planetarium"](around:${radiusMeters},${coords.lat},${coords.lon});
            
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
                contactPage: '', // Will be populated by fast detection
                address: extractAddress(element.tags),
                lat: element.lat || element.center?.lat,
                lon: element.lon || element.center?.lon
            };
            
            organizations.push(org);
        });
        
        // Fast contact page detection
        updateLoadingMessage('Finding contact pages...');
        const orgsWithContactPages = await processContactPagesFast(organizations);
        
        return orgsWithContactPages;
        
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

    // Exclude generic parks without facilities - but allow managed parks with operators/websites
    if (tags.leisure === 'park' && !tags.operator && !tags.website && !tags.tourism) return true;
    
    // Only exclude nature reserves without visitor centers
    if (tags.leisure === 'nature_reserve' && tags.visitor_centre !== 'yes') return true;

    // Exclude bars and nightclubs
    if (tags.amenity === 'nightclub' || tags.amenity === 'bar' || tags.amenity === 'pub') return true;

    // Don't exclude gardens, arboretums, conservatories, or observatories
    if (tags.leisure === 'botanical_garden' || tags.leisure === 'garden' || 
        tags.leisure === 'arboretum' || tags.landuse === 'arboretum' ||
        tags['garden:type'] || tags.building === 'conservatory' ||
        tags.man_made === 'observatory' || tags.amenity === 'planetarium') return false;

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
    
    // Botanical gardens and specialized gardens
    if (tags.leisure === 'botanical_garden' || tags['garden:type'] === 'botanical') return 'Botanical Garden';
    if (tags['garden:type'] === 'rose') return 'Rose Garden';
    if (tags['garden:type'] === 'japanese') return 'Japanese Garden';
    if (tags['garden:type'] === 'herb') return 'Herb Garden';
    if (tags['garden:type'] === 'sculpture') return 'Sculpture Garden';
    if (tags.leisure === 'garden' && tags['garden:type']) return 'Specialty Garden';
    
    // Nature and wildlife
    if (tags.tourism === 'zoo') return 'Zoo';
    if (tags.tourism === 'aquarium') return 'Aquarium';
    if (tags.leisure === 'nature_reserve') return 'Nature Reserve';
    if (tags.amenity === 'visitor_centre' || tags.information === 'visitor_centre') return 'Visitor Center';
    if (tags.leisure === 'wildlife_hide') return 'Wildlife Viewing';
    
    // Arboretums and tree collections
    if (tags.landuse === 'arboretum' || tags.leisure === 'arboretum') return 'Arboretum';
    
    // Conservatories and greenhouses
    if (tags.building === 'conservatory') return 'Conservatory';
    if (tags.greenhouse === 'yes' && tags.tourism) return 'Greenhouse & Gardens';
    
    // Managed parks
    if (tags.leisure === 'park' && (tags.operator || tags.website || tags.tourism === 'attraction')) return 'Public Garden & Park';
    
    // Educational centers
    if (tags.amenity === 'education_centre' && 
        (tags['education:type'] === 'environmental' || tags['education:type'] === 'nature')) return 'Environmental Education Center';
    
    // Observatory and planetarium
    if (tags.man_made === 'observatory') return 'Observatory';
    if (tags.amenity === 'planetarium') return 'Planetarium';
    
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

function displayResults(organizations) {
    console.log('Displaying results:', organizations.length);
    
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

        // Contact cell - prioritized display with verified contact pages
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
            
            // Add verified indicator for found contact pages
            const verifiedIcon = document.createElement('i');
            verifiedIcon.className = 'fas fa-check-circle';
            verifiedIcon.style.color = '#10B981';
            verifiedIcon.style.marginLeft = '4px';
            verifiedIcon.style.fontSize = '0.8em';
            verifiedIcon.title = 'Found on website';
            contactCell.appendChild(verifiedIcon);
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
    
    // Re-setup sortable headers after table is displayed
    setupSortableHeaders();
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
        
        // Gardens and nature
        'Botanical Garden': 'type-garden',
        'Rose Garden': 'type-garden',
        'Japanese Garden': 'type-garden', 
        'Herb Garden': 'type-garden',
        'Sculpture Garden': 'type-garden',
        'Specialty Garden': 'type-garden',
        'Arboretum': 'type-garden',
        'Conservatory': 'type-garden',
        'Greenhouse & Gardens': 'type-garden',
        'Public Garden & Park': 'type-outdoor',
        
        // Wildlife and nature
        'Zoo': 'type-outdoor',
        'Aquarium': 'type-outdoor',
        'Nature Reserve': 'type-outdoor',
        'Wildlife Viewing': 'type-outdoor',
        'Environmental Education Center': 'type-outdoor',
        
        // Science and astronomy
        'Observatory': 'type-museum',
        'Planetarium': 'type-museum',
        
        // Wellness
        'Spa & Wellness': 'type-wellness',
        'Yoga Studio': 'type-wellness',
        'Pilates Studio': 'type-wellness',
        'Dance Studio': 'type-wellness',
        
        // Creative
        'Artist Studio': 'type-workshop',
        'Pottery Studio': 'type-workshop',
        'Creative Workshop': 'type-workshop',
        
        // Historic
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
            
            // Add verified indicator
            const verifiedIcon = document.createElement('i');
            verifiedIcon.className = 'fas fa-check-circle';
            verifiedIcon.style.color = '#10B981';
            verifiedIcon.style.marginLeft = '4px';
            verifiedIcon.style.fontSize = '0.8em';
            verifiedIcon.title = 'Found on website';
            contactCell.appendChild(verifiedIcon);
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