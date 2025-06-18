// --- App Setup & Configuration ---
const app = document.getElementById('app');
const API_BASE_URL = '/api'; // IMPORTANT: Update this to your Cloud Run URL

// --- State Management ---
let currentPage = 'overview'; // Default page
let teamsCache = []; // Cache teams data to avoid repeated API calls
let allPlayersCache = []; // Cache all players data for client-side filtering

// --- Helper & Utility Functions ---

// Generates an SVG icon
function createSVG(dAttribute, color = "currentColor") {
    return `
        <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="${color}" viewBox="0 0 256 256">
            <path d="${dAttribute}"></path>
        </svg>
    `;
}

// Generates a placeholder image URL from UI Avatars
function generatePlaceholderImageUrl(name) {
    if (!name) return `https://ui-avatars.com/api/?name=UK&background=random&color=fff&size=128`; // Fallback for empty name
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials || name)}&background=random&color=fff&size=128`;
}

// Formats a Firestore Timestamp for display
function formatTimestamp(timestamp) {
    if (!timestamp || !timestamp._seconds) return 'N/A';
    const date = new Date(timestamp._seconds * 1000);
    return date.toLocaleString();
}

// --- API Communication ---
async function callAdminApi(endpoint, method = 'GET', data = null) {
    const user = firebase.auth().currentUser;
    if (!user) {
        throw new Error('No authenticated user found. Please log in.');
    }

    const idToken = await user.getIdToken();
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
    };

    const config = {
        method: method,
        headers: headers
    };

    if (data) {
        config.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/${endpoint}`, config);
        const responseData = await response.json();

        if (!response.ok) {
            const errorMessage = responseData.message || `HTTP error! status: ${response.status}`;
            const error = new Error(errorMessage);
            error.statusCode = response.status;
            throw error;
        }
        return responseData;
    } catch (error) {
        console.error(`API Call Error (${method} ${endpoint}):`, error);
        throw error;
    }
}

// --- Sidebar Configuration ---
const sidebarItems = [
    {
        page: 'overview',
        label: 'Overview',
        icon: "M218.83,103.77l-80-75.48a1.14,1.14,0,0,1-.11-.11,16,16,0,0,0-21.53,0l-.11.11L37.17,103.77A16,16,0,0,0,32,115.55V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V160h32v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V115.55A16,16,0,0,0,218.83,103.77ZM208,208H160V160a16,16,0,0,0-16-16H112a16,16,0,0,0-16,16v48H48V115.55l.11-.1L128,40l79.9,75.43.11.1Z",
        color: '#2563eb',
        altColor: '#6b7280',
    },
    {
        page: 'teams',
        label: 'Teams',
        icon: "M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z",
        color: '#2563eb',
        altColor: '#6b7280',
    },
    {
        page: 'players',
        label: 'Players',
        icon: "M244.8,150.4a8,8,0,0,1-11.2-1.6A51.6,51.6,0,0,0,192,128a8,8,0,0,1-7.37-4.89,8,8,0,0,1,0-6.22A8,8,0,0,1,192,112a24,24,0,1,0-23.24-30,8,8,0,1,1-15.5-4A40,40,0,1,1,219,117.51a67.94,67.94,0,0,1,27.43,21.68A8,8,0,0,1,244.8,150.4ZM190.92,212a8,8,0,1,1-13.84,8,57,57,0,0,0-98.16,0,8,8,0,1,1-13.84-8,72.06,72.06,0,0,1,33.74-29.92,48,48,0,1,1,58.36,0A72.06,72.06,0,0,1,190.92,212ZM128,176a32,32,0,1,0-32-32A32,32,0,0,0,128,176ZM72,120a8,8,0,0,0-8-8A24,24,0,1,1,87.24,82a8,8,0,1,0,15.5-4A40,40,0,1,0,37,117.51,67.94,67.94,0,0,0,9.6,139.19a8,8,0,1,0,12.8,9.61A51.6,51.6,0,0,1,64,128,8,8,0,0,0,72,120Z",
        color: '#2563eb',
        altColor: '#6b7280',
    },
    {
        page: 'matches',
        label: 'Matches',
        icon: "M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm76.52,147.42H170.9l-9.26-12.76,12.63-36.78,15-4.89,26.24,20.13A87.38,87.38,0,0,1,204.52,171.42ZM40.47,137.12a87.38,87.38,0,0,1,11-34.3l5.51,18.6L40.71,116.77A87.33,87.33,0,0,1,50.43,86.48ZM109,152,97.54,118.65,128,97.71l30.46,20.94L147,152Zm91.07-46.92,5.51-18.6a87.33,87.33,0,0,1,9.72,30.29Zm-6.2-35.38-9.51,32.08-15.07,4.89L136,83.79V68.21l29.09-20A88.58,88.58,0,0,1,193.86,69.7ZM146.07,41.87,128,54.29,109.93,41.87a88.24,88.24,0,0,1,36.14,0ZM90.91,48.21l29.09,20V83.79L86.72,106.67l-15.07-4.89L62.14,69.7A88.58,88.58,0,0,1,90.91,48.21ZM63.15,187.42H83.52l7.17,20.27A88.4,88.4,0,0,1,63.15,187.42ZM110,214.13,98.12,180.71,107.35,168h41.3l9.23,12.71-11.83,33.42a88,88,0,0,1-36.1,0Zm55.36-6.44,7.17-20.27h20.37A88.4,88.4,0,0,1,165.31,207.69Z",
        color: '#2563eb',
        altColor: '#6b7280',
    },
    {
        page: 'news',
        label: 'News',
        icon: "M216,48H56A16,16,0,0,0,40,64V184a8,8,0,0,1-16,0V88A8,8,0,0,0,8,88v96.11A24,24,0,0,0,32,208H208a24,24,0,0,0,24-24V64A16,16,0,0,0,216,48ZM176,152H96a8,8,0,0,1,0-16h80a8,8,0,0,1,0,16Zm0-32H96a8,8,0,0,1,0-16h80a8,8,0,0,1,0,16Z",
        color: '#2563eb',
        altColor: '#6b7280',
    },
];

// --- Dynamic Page & Component Rendering ---

async function renderAppLayout() {
    const user = firebase.auth().currentUser;
    if (!app || !user) {
        renderLoginPage();
        return;
    }

    const userName = user.email || 'Admin'; // Get user's email or default to 'Admin'

    app.innerHTML = `
        <div class="flex h-screen bg-gray-100">
            <div class="w-64 bg-white shadow-md">
                <div class="p-6 border-b border-gray-200">
                    <h1 class="text-2xl font-bold text-gray-900">Admin Panel</h1>
                    <p class="text-sm text-gray-500 mt-2">${userName}</p>
                </div>
                <nav class="mt-6">
                    ${sidebarItems.map(item => `
                        <a href="#" data-page="${item.page}" class="flex items-center gap-3 px-6 py-3 ${currentPage === item.page ? 'rounded-full bg-blue-100 text-blue-800 font-semibold' : 'text-gray-700 hover:bg-gray-200'} cursor-pointer">
                            ${createSVG(item.icon, currentPage === item.page ? item.color : item.altColor)}
                            <span>${item.label}</span>
                        </a>
                    `).join('')}
                </nav>
            </div>

            <div class="flex-1 flex flex-col overflow-hidden">
                <header class="flex justify-between items-center p-6 bg-white border-b border-gray-200">
                    <h2 class="text-2xl font-semibold text-gray-800">Hsig Khaung Premier League</h2>
                    <button id="logout-btn" class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Logout</button>
                </header>

                <main id="main-content-area" class="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6"></main>
            </div>
        </div>
    `;

    updateMainContent();
}

// Generic function to render a list page (Teams, Players, Matches, News)
async function renderEntityPage(container, pageTitle, addBtnId, addBtnText, fetchDataCallback, createTableCallback, options = {}) {
    // Show loading animation in the container
    showLoading(`#${container.id}`);
    try {
        const data = await fetchDataCallback();
        // createTableCallback now directly receives necessary data, including teams for players/matches
        const tableHtml = createTableCallback(data, options.teams);

        let searchBarHtml = '';
        if (options.showSearchBar) {
            searchBarHtml = `<input type="text" id="${pageTitle.toLowerCase()}-search-bar" placeholder="Search ${pageTitle.toLowerCase()} by name..." class="w-full px-4 py-2 mb-4 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500">`;
        }

        hideLoading();
        container.innerHTML = `
            <div class="flex flex-wrap justify-between gap-3 p-4">
                <p class="text-gray-900 tracking-light text-[32px] font-bold leading-tight min-w-72">${pageTitle}</p>
                <button id="${addBtnId}" class="flex min-w-[84px] cursor-pointer items-center justify-center rounded-full h-10 px-4 bg-blue-600 text-white text-sm font-medium">${addBtnText}</button>
            </div>
            <div class="px-4 py-3">
                ${searchBarHtml}
                <div id="${pageTitle.toLowerCase()}-table-container">
                    ${tableHtml}
                </div>
            </div>
        `;

        if (options.showSearchBar) {
            document.getElementById(`${pageTitle.toLowerCase()}-search-bar`).addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                // Filter the original full data, not the already filtered one
                const filteredData = options.filterCallback(data, searchTerm);
                document.getElementById(`${pageTitle.toLowerCase()}-table-container`).innerHTML = createTableCallback(filteredData, options.teams);
            });
        }

    } catch (error) {
        hideLoading();
        console.error(`Failed to render ${pageTitle.toLowerCase()} page:`, error);
        container.innerHTML = `<div class="p-8 text-red-600">Error loading ${pageTitle.toLowerCase()} data: ${error.message}</div>`;
    }
}

// Generic function to create HTML for a table
function createTableHtml(headers, data, createRowCallback) {
    const tableRows = data.map((item, index) => createRowCallback(item, index)).join('');

    const headerHtml = headers.map(header => `
        <th class="${header.class || ''} px-4 py-3 text-left text-blue-800 text-sm font-medium">${header.text}</th>
    `).join('');

    return `
        <div class="flex overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
            <table class="flex-1 w-full">
                <thead>
                    <tr class="bg-blue-100">
                        ${headerHtml}
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">${tableRows}</tbody>
            </table>
        </div>
    `;
}


async function getTeams() {
    if (teamsCache.length === 0) {
        teamsCache = await callAdminApi('teams');
    }
    return teamsCache;
}

async function updateMainContent() {
    const mainContentArea = document.getElementById('main-content-area');
    if (!mainContentArea) return;

    showLoading('#main-content-area'); // Show loading animation

    try {
        switch (currentPage) {
            case 'overview':
                hideLoading();
                mainContentArea.innerHTML = await createOverviewContent();
                break;
            case 'teams':
                await renderEntityPage(
                    mainContentArea,
                    'Teams',
                    'add-team-btn',
                    'Add Team',
                    getTeams,
                    createTeamsTable // Calls the refactored createTeamsTable
                );
                break;
            case 'players':
                const teamsForPlayers = await getTeams(); // Fetch teams once for player dropdowns
                await renderEntityPage(
                    mainContentArea,
                    'Players',
                    'add-player-btn',
                    'Add Player',
                    async () => {
                        if (allPlayersCache.length === 0) {
                            allPlayersCache = await callAdminApi('players');
                        }
                        return allPlayersCache;
                    },
                    createPlayersTable, // Calls the refactored createPlayersTable
                    {
                        showSearchBar: true,
                        filterCallback: (players, searchTerm) => allPlayersCache.filter(player =>
                            player.name.toLowerCase().includes(searchTerm) ||
                            (player.name_en && player.name_en.toLowerCase().includes(searchTerm)) ||
                            (teamsForPlayers.find(t => t.id === player.team_id)?.name.toLowerCase().includes(searchTerm))
                        ),
                        teams: teamsForPlayers // Pass teams to createPlayersTable
                    }
                );
                break;
            case 'matches':
                const teamsForMatches = await getTeams(); // Fetch teams once for match display
                await renderEntityPage(
                    mainContentArea,
                    'Matches',
                    'add-match-btn',
                    'Add Match',
                    () => callAdminApi('matches'),
                    createMatchesTable, // Calls the refactored createMatchesTable
                    { teams: teamsForMatches } // Pass teams to createMatchesTable
                );
                break;
            case 'news':
                await renderEntityPage(
                    mainContentArea,
                    'News',
                    'add-news-btn',
                    'Add News',
                    () => callAdminApi('news'),
                    createNewsTable // Calls the refactored createNewsTable
                );
                break;
            default:
                mainContentArea.innerHTML = `<div class="p-8">Page not found.</div>`;
        }
    } catch (error) {
        console.error(`Failed to render page: ${currentPage}`, error);
        mainContentArea.innerHTML = `<div class="p-8 text-red-600">Error loading content: ${error.message}</div>`;
    }
}


// --- Page-Specific Content Creators (now calls generic table creator) ---

async function createOverviewContent() {
    try {
        const [teams, players, matches, news] = await Promise.all([
            callAdminApi('teams'),
            callAdminApi('players'),
            callAdminApi('matches'),
            callAdminApi('news')
        ]);

        return `
            <div class="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div data-page="teams" class="bg-white p-6 rounded-lg shadow-md cursor-pointer hover:shadow-lg transition-shadow">
                    <h3 class="text-lg font-semibold text-gray-700">Total Teams</h3>
                    <p class="text-3xl font-bold text-blue-600 mt-2">${teams.length}</p>
                </div>
                <div data-page="players" class="bg-white p-6 rounded-lg shadow-md cursor-pointer hover:shadow-lg transition-shadow">
                    <h3 class="text-lg font-semibold text-gray-700">Total Players</h3>
                    <p class="text-3xl font-bold text-green-600 mt-2">${players.length}</p>
                </div>
                <div data-page="matches" class="bg-white p-6 rounded-lg shadow-md cursor-pointer hover:shadow-lg transition-shadow">
                    <h3 class="text-lg font-semibold text-gray-700">Total Matches</h3>
                    <p class="text-3xl font-bold text-purple-600 mt-2">${matches.length}</p>
                </div>
                <div data-page="news" class="bg-white p-6 rounded-lg shadow-md cursor-pointer hover:shadow-lg transition-shadow">
                    <h3 class="text-lg font-semibold text-gray-700">Total News Articles</h3>
                    <p class="text-3xl font-bold text-orange-600 mt-2">${news.length}</p>
                </div>
            </div>
            <div class="p-4 mt-6">
                <h2 class="text-2xl font-bold text-gray-900">Recent Activity</h2>
                <p class="text-gray-600 mt-2">More detailed activity logs or recent additions could go here.</p>
            </div>
        `;
    } catch (error) {
        console.error("Error loading overview content:", error);
        return `<div class="p-8 text-red-600">Error loading overview data: ${error.message}</div>`;
    }
}

// Table functions now primarily use the generic createTableHtml
function createTeamsTable(teams) {
    const headers = [
        { text: 'Logo', class: 'w-[8%] logo-col' },
        { text: 'Name', class: 'w-[15%] team-name-col' },
        { text: 'MM Name', class: 'w-[15%] english-name-col' },
        { text: 'P', class: 'w-[7%] played-col text-center' },
        { text: 'W', class: 'w-[7%] wins-col text-center' },
        { text: 'D', class: 'w-[7%] draws-col text-center' },
        { text: 'L', class: 'w-[7%] losses-col text-center' },
        { text: 'GF', class: 'w-[7%] goals-for-col text-center' },
        { text: 'GA', class: 'w-[7%] goals-against-col text-center' },
        { text: 'Actions', class: 'w-[5%] team-actions-col' }
    ];
    return createTableHtml(headers, teams, createTeamsTableRow);
}

function createTeamsTableRow(team, index) {
    return `
        <tr class="border-t border-gray-200 ${index % 2 === 1 ? 'bg-gray-50' : 'bg-white'}">
            <td class="logo-col h-[72px] px-4 py-2"><img src="${team.LogoUrl || generatePlaceholderImageUrl(team.name)}" class="w-10 h-10 rounded-full object-cover" alt="${team.name} logo"></td>
            <td class="team-name-col h-[72px] px-4 py-2 text-gray-800 font-medium">${team.name}</td>
            <td class="english-name-col h-[72px] px-4 py-2 text-gray-600">${team.name_mm || ''}</td>
            <td class="played-col h-[72px] px-4 py-2 text-center text-gray-700">${team.played}</td>
            <td class="wins-col h-[72px] px-4 py-2 text-center text-gray-700">${team.won}</td>
            <td class="draws-col h-[72px] px-4 py-2 text-center text-gray-700">${team.draw}</td>
            <td class="losses-col h-[72px] px-4 py-2 text-center text-gray-700">${team.lost}</td>
            <td class="goals-for-col h-[72px] px-4 py-2 text-center text-gray-700">${team.gf}</td>
            <td class="goals-against-col h-[72px] px-4 py-2 text-center text-gray-700">${team.ga}</td>
            <td class="team-actions-col h-[72px] px-4 py-2 text-sm font-bold">
                <button data-id="${team.id}" class="edit-team-btn text-blue-600 hover:underline">Edit</button>
            </td>
        </tr>
    `;
}

function createPlayersTable(players, teams) {
    const headers = [
        { text: 'Image', class: 'w-[10%] image-col' },
        { text: 'Name', class: 'w-[15%] player-name-col' },
        { text: 'English Name', class: 'w-[15%] english-name-col' },
        { text: 'Number', class: 'w-[10%] shirt-number-col text-center' },
        { text: 'Position', class: 'w-[15%] position-col text-center' },
        { text: 'Team', class: 'w-[20%] team-col' },
        { text: 'Actions', class: 'w-[5%] team-actions-col' }
    ];
    return createTableHtml(headers, players, (player, index) => createPlayersTableRow(player, index, teams));
}

function createPlayersTableRow(player, index, teams) { // teams is passed via options in renderEntityPage
    const teamName = teams.find(t => t.id === player.team_id)?.name || 'Unknown';
    const imageUrl = player.imageUrl || generatePlaceholderImageUrl(player.name_en || player.name);
    return `
        <tr class="border-t border-gray-200 ${index % 2 === 1 ? 'bg-gray-50' : 'bg-white'}">
            <td class="image-col h-[72px] px-4 py-2"><img src="${imageUrl}" class="w-10 h-10 rounded-full object-cover" alt="${player.name}"></td>
            <td class="player-name-col h-[72px] px-4 py-2 text-gray-800 font-medium">${player.name}</td>
            <td class="english-name-col h-[72px] px-4 py-2 text-gray-600">${player.name_en || ''}</td>
            <td class="shirt-number-col h-[72px] px-4 py-2 text-center text-gray-700">${player.number}</td>
            <td class="position-col h-[72px] px-4 py-2 text-center text-gray-700">${player.position}</td>
            <td class="team-col h-[72px] px-4 py-2 text-gray-700">${teamName}</td>
            <td class="team-actions-col h-[72px] px-4 py-2 text-sm font-bold">
                <button data-id="${player.id}" class="edit-player-btn text-blue-600 hover:underline">Edit</button>
            </td>
        </tr>
    `;
}

function createMatchesTable(matches, teams) {
    const headers = [
        { text: 'Date', class: 'w-[15%] match-date-col' },
        { text: 'Time', class: 'w-[10%] match-time-col' },
        { text: 'Home Team', class: 'w-[25%] match-teams-col' },
        { text: 'Away Team', class: 'w-[25%] match-teams-col' },
        { text: 'Score', class: 'w-[10%] match-score-col text-center' },
        { text: 'Status', class: 'w-[10%] match-status-col text-center' },
        { text: 'Actions', class: 'w-[5%] match-actions-col' }
    ];
    return createTableHtml(headers, matches, (match, index) => createMatchesTableRow(match, index, teams));
}

function createMatchesTableRow(match, index, teams) {
    const homeTeam = teams.find(t => t.id === match.homeTeamId);
    const awayTeam = teams.find(t => t.id === match.awayTeamId);
    return `
        <tr class="border-t border-gray-200 ${index % 2 === 1 ? 'bg-gray-50' : 'bg-white'}">
            <td class="match-date-col h-[72px] px-4 py-2 text-gray-600">${match.date}</td>
            <td class="match-time-col h-[72px] px-4 py-2 text-gray-600">${match.time}</td>
            <td class="match-teams-col h-[72px] px-4 py-2 text-gray-800 font-medium">
                <div class="flex items-center gap-2">
                    <img src="${homeTeam?.LogoUrl || generatePlaceholderImageUrl(homeTeam?.name)}" class="w-6 h-6 rounded-full" onerror="this.src='${generatePlaceholderImageUrl('Unknown')}';">
                    <span>${homeTeam?.name || 'N/A'}</span>
                </div>
            </td>
            <td class="match-teams-col h-[72px] px-4 py-2 text-gray-800 font-medium">
                 <div class="flex items-center gap-2">
                    <img src="${awayTeam?.LogoUrl || generatePlaceholderImageUrl(awayTeam?.name)}" class="w-6 h-6 rounded-full" onerror="this.src='${generatePlaceholderImageUrl('Unknown')}';">
                    <span>${awayTeam?.name || 'N/A'}</span>
                </div>
            </td>
            <td class="match-score-col h-[72px] px-4 py-2 text-center font-bold">${match.homeScore} - ${match.awayScore}</td>
            <td class="match-status-col h-[72px] px-4 py-2 text-center capitalize">${match.status}</td>
            <td class="match-actions-col h-[72px] px-4 py-2 text-sm font-bold">
                <button data-id="${match.id}" class="edit-match-btn text-blue-600 hover:underline">Edit</button>
            </td>
        </tr>
    `;
}


function createNewsTable(newsArticles) {
    const headers = [
        { text: 'Title', class: 'w-[30%] news-title-col' },
        { text: 'Body Snippet', class: 'w-[40%] news-body-col' },
        { text: 'Date', class: 'w-[15%] news-date-col' },
        { text: 'Tags', class: 'w-[10%] news-tags-col' },
        { text: 'Actions', class: 'w-[5%] news-actions-col' }
    ];
    return createTableHtml(headers, newsArticles, createNewsTableRow);
}

function createNewsTableRow(news, index) {
    return `
        <tr class="border-t border-gray-200 ${index % 2 === 1 ? 'bg-gray-50' : 'bg-white'}">
            <td class="news-title-col h-[72px] px-4 py-2 text-gray-800 font-medium">${news.title}</td>
            <td class="news-body-col h-[72px] px-4 py-2 text-gray-600">${news.body.substring(0, 70)}${news.body.length > 70 ? '...' : ''}</td>
            <td class="news-date-col h-[72px] px-4 py-2 text-gray-600">${formatTimestamp(news.date)}</td>
            <td class="news-tags-col h-[72px] px-4 py-2 text-gray-600">${(news.tags || []).join(', ') || 'N/A'}</td>
            <td class="news-actions-col h-[72px] px-4 py-2 text-sm font-bold">
                <button data-id="${news.id}" class="edit-news-btn text-blue-600 hover:underline">Edit</button>
            </td>
        </tr>
    `;
}

// --- Login Page ---
function renderLoginPage() {
    if (!app) return;
    app.innerHTML = `
        <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div class="max-w-md w-full space-y-8">
                <div>
                    <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Sign in to your account
                    </h2>
                </div>
                <form class="mt-8 space-y-6" id="login-form">
                    <div class="rounded-md shadow-sm -space-y-px">
                        <div>
                            <label for="email-address" class="sr-only">Email address</label>
                            <input id="email-address" name="email" type="email" autocomplete="email" required
                                class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Email address">
                        </div>
                        <div>
                            <label for="password" class="sr-only">Password</label>
                            <input id="password" name="password" type="password" autocomplete="current-password" required
                                class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Password">
                        </div>
                    </div>

                    <div>
                        <button type="submit"
                            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                            Sign in
                        </button>
                    </div>
                    <p id="login-error-message" class="text-center text-red-600 text-sm"></p>
                </form>
            </div>
        </div>
    `;

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email-address').value;
        const password = document.getElementById('password').value;
        const errorMessageDiv = document.getElementById('login-error-message');
        errorMessageDiv.textContent = '';

        try {
            await firebase.auth().signInWithEmailAndPassword(email, password);
            // Firebase auth state change listener will handle rendering app layout
        } catch (error) {
            console.error('Login error:', error);
            errorMessageDiv.textContent = 'Login failed: ' + (error.message || 'Please check your credentials.');
        }
    });
}

// --- Modals ---
const modalContainer = document.createElement('div');
modalContainer.id = 'modal-container';
document.body.appendChild(modalContainer);

// --- Dynamic Form Modal Schema ---
const formSchemas = {
    player: [
        { label: 'Player Name', name: 'name', type: 'text', required: true },
        { label: 'Name (English)', name: 'name_en', type: 'text', required: true },
        { label: 'Shirt Number', name: 'number', type: 'number', required: false },
        { label: 'Team', name: 'team_id', type: 'select', required: true, optionsKey: 'teams' },
        { label: 'Position', name: 'position', type: 'select', required: true, options: [
            { value: '', label: 'Select Position' },
            { value: 'GK', label: 'GK (Goalkeeper)' },
            { value: 'DF', label: 'DF (Defender)' },
            { value: 'MF', label: 'MF (Midfielder)' },
            { value: 'FW', label: 'FW (Forward)' },
        ] },
        { label: 'Image URL', name: 'imageUrl', type: 'text', required: false },
    ],
    team: [
        { label: 'Team ID (Shortform)', name: 'team_id', type: 'text', required: true },
        { label: 'Logo URL', name: 'LogoUrl', type: 'text', required: false },
        { label: 'Team Name', name: 'name', type: 'text', required: true },
        { label: 'MM Name', name: 'name_mm', type: 'text', required: false },
        { label: 'P', name: 'played', type: 'number', required: false },
        { label: 'W', name: 'won', type: 'number', required: false },
        { label: 'D', name: 'draw', type: 'number', required: false },
        { label: 'L', name: 'lost', type: 'number', required: false },
        { label: 'GF', name: 'gf', type: 'number', required: false },
        { label: 'GA', name: 'ga', type: 'number', required: false },
    ],
    news: [
        { label: 'Title', name: 'title', type: 'text', required: true },
        { label: 'Body', name: 'body', type: 'richtext', required: true },
        { label: 'Tags', name: 'tags', type: 'tags', required: false },
        { label: 'Image URLs', name: 'imgUrl', type: 'imgurls', required: false },
        { label: 'Author', name: 'author', type: 'hidden', required: false, default: 'admin' },
    ],
    match: [
        { label: 'Date', name: 'date', type: 'date', required: true },
        { label: 'Time', name: 'time', type: 'time', required: true },
        { label: 'Home Team', name: 'home_team', type: 'select', required: true, optionsKey: 'teams' },
        { label: 'Away Team', name: 'away_team', type: 'select', required: true, optionsKey: 'teams' },
        { label: 'Home Team Score', name: 'home_score', type: 'number', required: true, maxLength: 2 },
        { label: 'Away Team Score', name: 'away_score', type: 'number', required: true, maxLength: 2 },
        { label: 'Status', name: 'status', type: 'select', required: true, options: [
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'ongoing', label: 'Ongoing' },
            { value: 'finished', label: 'Finished' },
        ] },
    ],
};

// --- Dynamic Form Modal Generator ---
async function showFormModal(entityType, fetchDataFunction, submitApiEndpoint, editData = null) {
    const schema = formSchemas[entityType];
    let dataOptions = {};
    if (entityType === 'player' || entityType === 'match') {
        dataOptions.teams = await fetchDataFunction();
    }
    // Set modal title dynamically
    const entityTitles = {
        player: 'Add Player',
        team: editData ? 'Edit Team' : 'Add Team',
        news: 'Add News',
        match: 'Add Match',
    };
    const title = entityTitles[entityType] || `Add ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`;

    // Row-wise table for player and team
    if (entityType === 'player' || entityType === 'team') {
        // Generate table header row
        const headerRow = schema.map(field => `<th class="px-4 py-3 text-left text-blue-800 text-sm font-medium leading-normal">${field.label}</th>`).join('') + '<th></th>';
        // Generate input row function
        function getInputRow(idx = 0, editDataRow = null) {
            return schema.map(field => {
                const value = editDataRow && field.name in editDataRow ? editDataRow[field.name] || '' : '';
                // Number fields: narrow
                if (["number", "played", "won", "draw", "lost", "gf", "ga"].includes(field.name) || field.type === 'number') {
                    return `<td class=\"px-2 py-2\"><input type=\"number\" name=\"${field.name}\" class=\"w-16 px-1 py-1 border border-gray-300 rounded-md text-center\" ${field.required ? 'required' : ''} value=\"${value}\"></td>`;
                }
                // Image/Logo preview and input: small and square
                if (entityType === 'player' && field.name === 'imageUrl') {
                    return `<td class=\"px-2 py-2 text-center">
                        <div class=\"player-image-preview aspect-square bg-cover rounded-full w-16 h-16 mx-auto mb-1\" style=\"background-image: url('${value || generatePlaceholderImageUrl(editDataRow?.name_en || editDataRow?.name || '')}');\"></div>
                        <input type=\"text\" name=\"${field.name}\" class=\"w-24 px-1 py-1 border border-gray-300 rounded-md mt-1 text-xs player-image-url-input\" placeholder=\"Image URL (optional)\" value=\"${value}\">
                    </td>`;
                }
                if (entityType === 'team' && field.name === 'LogoUrl') {
                    return `<td class=\"px-2 py-2 text-center">
                        <div class=\"team-logo-preview aspect-square bg-cover rounded-full w-16 h-16 mx-auto mb-1\" style=\"background-image: url('${value || generatePlaceholderImageUrl(editDataRow?.name || editDataRow?.name_mm || '')}');\"></div>
                        <input type=\"text\" name=\"${field.name}\" class=\"w-24 px-1 py-1 border border-gray-300 rounded-md mt-1 text-xs team-logo-url-input\" placeholder=\"Logo URL (optional)\" value=\"${value}\">
                    </td>`;
                }
                // Name fields: moderate width
                if (["name", "name_en", "name_mm"].includes(field.name)) {
                    return `<td class=\"px-2 py-2\"><input type=\"text\" name=\"${field.name}\" class=\"w-40 px-2 py-1 border border-gray-300 rounded-md\" ${field.required ? 'required' : ''} value=\"${value}\"></td>`;
                }
                // Select fields: moderate width
                if (field.type === 'select') {
                    const options = field.optionsKey && dataOptions[field.optionsKey]
                        ? `<option value=\"\">Select</option>` + dataOptions[field.optionsKey].map(opt => `<option value=\"${opt.id}\" ${value == opt.id ? 'selected' : ''}>${opt.name}</option>`).join('')
                        : (field.options || []).map(opt => `<option value=\"${opt.value}\" ${value == opt.value ? 'selected' : ''}>${opt.label}</option>`).join('');
                    return `<td class=\"px-2 py-2\"><select name=\"${field.name}\" class=\"w-40 px-2 py-1 border border-gray-300 rounded-md\">${options}</select></td>`;
                }
                // Default: moderate width
                return `<td class=\"px-2 py-2\"><input type=\"${field.type}\" name=\"${field.name}\" class=\"w-40 px-2 py-1 border border-gray-300 rounded-md\" ${field.required ? 'required' : ''} value=\"${value}\"></td>`;
            }).join('') + `<td class=\"px-2 py-2 text-center\">${editData ? '' : '<button type=\"button\" class=\"remove-row-btn text-red-600 hover:text-red-800 text-sm font-bold\">Remove</button>'}</td>`;
        }
        modalContainer.innerHTML = `
            <div class=\"fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center\">
                <div class=\"bg-white p-6 rounded-lg shadow-xl max-w-6xl w-full min-w-[900px] mx-4 relative\">
                    <button class=\"modal-close-btn absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-2xl font-bold\">&times;</button>
                    <h2 class=\"text-gray-900 text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5\">${title}</h2>
                    <form id=\"dynamic-form\" class=\"px-4 py-3\">
                        <div class=\"flex overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 mb-4\">
                            <table class=\"flex-1 w-full min-w-max\">
                                <thead><tr class=\"bg-blue-100\">${headerRow}</tr></thead>
                                <tbody id=\"modal-input-rows\"><tr>${getInputRow(0, editData)}</tr></tbody>
                            </table>
                        </div>
                        <div class=\"flex gap-3 flex-wrap justify-start mb-2\">
                            ${editData ? '' : `<button type=\"button\" id=\"add-more-row-btn\" class=\"min-w-[84px] cursor-pointer rounded-xl h-10 px-4 bg-gray-200 text-gray-900 text-sm font-bold\">Add More ${entityType === 'player' ? 'Player' : 'Team'}</button>`}
                            <button type=\"submit\" class=\"min-w-[84px] cursor-pointer rounded-xl h-10 px-4 bg-blue-600 text-white text-sm font-bold\">${editData ? 'Update' : `Submit ${entityType === 'player' ? 'Players' : 'Teams'}`}</button>
                        </div>
                        <p id=\"${entityType}-modal-message\" class=\"mt-4 text-sm px-4\"></p>
                    </form>
                </div>
            </div>
        `;
        // Modal close logic
        document.querySelector('.modal-close-btn').addEventListener('click', () => { modalContainer.innerHTML = ''; });
        modalContainer.addEventListener('click', (e) => { if (e.target === modalContainer.firstElementChild) { modalContainer.innerHTML = ''; } });
        modalContainer.querySelector('.bg-white').addEventListener('click', (e) => e.stopPropagation());
        // Add/Remove row logic (disabled in edit mode)
        if (!editData) {
            const form = document.getElementById('dynamic-form');
            const tableBody = form.querySelector('#modal-input-rows');
            form.addEventListener('click', (e) => {
                if (e.target.classList.contains('remove-row-btn')) {
                    if (tableBody.children.length > 1) {
                        e.target.closest('tr').remove();
                    }
                }
            });
            document.getElementById('add-more-row-btn').addEventListener('click', () => {
                const newRow = document.createElement('tr');
                newRow.innerHTML = getInputRow(tableBody.children.length);
                tableBody.appendChild(newRow);
            });
        }
        // Image/Logo preview update logic
        function updateImagePreview(row, type) {
            if (type === 'player') {
                const nameInput = row.querySelector('input[name="name"]');
                const nameEnInput = row.querySelector('input[name="name_en"]');
                const imageUrlInput = row.querySelector('input[name="imageUrl"]');
                const preview = row.querySelector('.player-image-preview');
                function setPreview() {
                    const url = imageUrlInput.value.trim();
                    if (url) preview.style.backgroundImage = `url('${url}')`;
                    else preview.style.backgroundImage = `url('${generatePlaceholderImageUrl(nameEnInput.value || nameInput.value)}')`;
                }
                nameInput.addEventListener('input', setPreview);
                nameEnInput.addEventListener('input', setPreview);
                imageUrlInput.addEventListener('input', setPreview);
            }
            if (type === 'team') {
                const nameInput = row.querySelector('input[name="name"]');
                const nameMmInput = row.querySelector('input[name="name_mm"]');
                const logoUrlInput = row.querySelector('input[name="LogoUrl"]');
                const preview = row.querySelector('.team-logo-preview');
                function setPreview() {
                    const url = logoUrlInput.value.trim();
                    if (url) preview.style.backgroundImage = `url('${url}')`;
                    else preview.style.backgroundImage = `url('${generatePlaceholderImageUrl(nameInput.value || nameMmInput.value)}')`;
                }
                nameInput.addEventListener('input', setPreview);
                nameMmInput.addEventListener('input', setPreview);
                logoUrlInput.addEventListener('input', setPreview);
            }
        }
        // Attach preview logic to all rows
        const tableBody = document.getElementById('modal-input-rows');
        Array.from(tableBody.children).forEach(row => updateImagePreview(row, entityType));
        // Attach preview logic to new rows
        if (!editData) {
            const observer = new MutationObserver(() => {
                Array.from(tableBody.children).forEach(row => {
                    if (!row._previewAttached) {
                        updateImagePreview(row, entityType);
                        row._previewAttached = true;
                    }
                });
            });
            observer.observe(tableBody, { childList: true });
        }
        // Form submit logic
        const form = document.getElementById('dynamic-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rows = Array.from(tableBody.querySelectorAll('tr'));
            const items = rows.map(row => {
                const item = {};
                schema.forEach((field, idx) => {
                    const input = row.querySelector(`[name="${field.name}"]`);
                    if (input) {
                        item[field.name] = field.type === 'number' ? parseInt(input.value, 10) || 0 : input.value;
                    }
                });
                // Fallbacks for image/logo
                if (entityType === 'player' && !item.imageUrl) {
                    item.imageUrl = generatePlaceholderImageUrl(item.name_en || item.name);
                }
                if (entityType === 'team' && !item.LogoUrl) {
                    item.LogoUrl = generatePlaceholderImageUrl(item.name || item.name_mm);
                }
                return item;
            });
            const modalMessage = document.getElementById(`${entityType}-modal-message`);
            showLoading();
            try {
                if (editData && editData.id) {
                    await callAdminApi(submitApiEndpoint, 'PUT', items[0]);
                    modalMessage.textContent = `${title} updated successfully!`;
                } else {
                    await Promise.all(items.map(data => callAdminApi(submitApiEndpoint, 'POST', data)));
                    modalMessage.textContent = `${title} added successfully!`;
                }
                modalMessage.className = 'mt-4 text-sm px-4 text-green-600';
                // Reload only the relevant data for this entity
                if (entityType === 'team') teamsCache = [];
                if (entityType === 'player') allPlayersCache = [];
                setTimeout(() => { hideLoading(); modalContainer.innerHTML = ''; updateMainContent(); }, 1200);
            } catch (error) {
                hideLoading();
                modalMessage.textContent = `Error: ${error.message}`;
                modalMessage.className = 'mt-4 text-sm px-4 text-red-600';
            }
        });
        return;
    }
    // Match modal special logic
    if (entityType === 'match') {
        // If editing, show team names, date, and time as readonly text fields
        let homeTeamName = '', awayTeamName = '', dateValue = '', timeValue = '', homeScore = '', awayScore = '', statusValue = '';
        if (editData) {
            // Find team names from teamsCache
            const teams = Array.isArray(teamsCache) && teamsCache.length > 0 ? teamsCache : await getTeams();
            const homeTeam = teams.find(t => t.id == editData.home_team);
            const awayTeam = teams.find(t => t.id == editData.away_team);
            homeTeamName = homeTeam ? homeTeam.name : (editData.home_team || '[No Home Team]');
            awayTeamName = awayTeam ? awayTeam.name : (editData.away_team || '[No Away Team]');
            dateValue = editData.date || '[No Date]';
            timeValue = editData.time || '[No Time]';
            homeScore = editData.home_score ?? '';
            awayScore = editData.away_score ?? '';
            statusValue = editData.status || '';
        }
        modalContainer.innerHTML = `
            <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
                <div class="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full min-w-[500px] mx-4 relative border-4 border-blue-400">
                    <button class="modal-close-btn absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-2xl font-bold">&times;</button>
                    <h2 class="text-gray-900 text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">${editData ? 'Edit Match' : 'Add Match'}</h2>
                    <form id="add-match-form" class="px-4 py-3 space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium mb-1">Date *</label>
                                ${editData ? `<input type="text" class="w-full px-2 py-1 border border-gray-200 rounded-md bg-gray-100 text-gray-500" value="${dateValue}" readonly>` : `<input type="date" id="addMatchDate" class="w-full px-2 py-1 border border-gray-300 rounded-md" required>`}
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-1">Time *</label>
                                ${editData ? `<input type="text" class="w-full px-2 py-1 border border-gray-200 rounded-md bg-gray-100 text-gray-500" value="${timeValue}" readonly>` : `<input type="time" id="addMatchTime" class="w-full px-2 py-1 border border-gray-300 rounded-md" required>`}
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-1">Home Team *</label>
                                ${editData ? `<input type="text" class="w-full px-2 py-1 border border-gray-200 rounded-md bg-gray-100 text-gray-500" value="${homeTeamName}" readonly>` : `<select id="addMatchHomeTeamId" class="w-full px-2 py-1 border border-gray-300 rounded-md" required><option value="">Select Home Team</option>${dataOptions.teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}</select>`}
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-1">Away Team *</label>
                                ${editData ? `<input type="text" class="w-full px-2 py-1 border border-gray-200 rounded-md bg-gray-100 text-gray-500" value="${awayTeamName}" readonly>` : `<select id="addMatchAwayTeamId" class="w-full px-2 py-1 border border-gray-300 rounded-md" required><option value="">Select Away Team</option>${dataOptions.teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}</select>`}
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-1">Home Team Score *</label>
                                <input type="number" id="addMatchHomeScore" class="w-20 px-2 py-1 border border-gray-300 rounded-md text-center" maxlength="2" min="0" max="99" required value="${homeScore}">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-1">Away Team Score *</label>
                                <input type="number" id="addMatchAwayScore" class="w-20 px-2 py-1 border border-gray-300 rounded-md text-center" maxlength="2" min="0" max="99" required value="${awayScore}">
                            </div>
                            <div class="col-span-2">
                                <label class="block text-sm font-medium mb-1">Status *</label>
                                <select id="addMatchStatus" class="w-full px-2 py-1 border border-gray-300 rounded-md" required>
                                    <option value="upcoming" ${statusValue === 'upcoming' ? 'selected' : ''}>Upcoming</option>
                                    <option value="ongoing" ${statusValue === 'ongoing' ? 'selected' : ''}>Ongoing</option>
                                    <option value="finished" ${statusValue === 'finished' ? 'selected' : ''}>Finished</option>
                                </select>
                            </div>
                        </div>
                        <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-md font-bold mt-4">${editData ? 'Update' : 'Submit'}</button>
                        <p id="match-form-message" class="mt-4 text-sm px-4"></p>
                    </form>
                </div>
            </div>
        `;
        // Modal close logic
        document.querySelector('.modal-close-btn').addEventListener('click', () => { modalContainer.innerHTML = ''; });
        modalContainer.addEventListener('click', (e) => { if (e.target === modalContainer.firstElementChild) { modalContainer.innerHTML = ''; } });
        modalContainer.querySelector('.bg-white').addEventListener('click', (e) => e.stopPropagation());
        // Only add team filtering if not edit mode
        if (!editData) {
            const homeSelect = document.getElementById('addMatchHomeTeamId');
            const awaySelect = document.getElementById('addMatchAwayTeamId');
            homeSelect.addEventListener('change', () => {
                const homeId = homeSelect.value;
                Array.from(awaySelect.options).forEach(opt => {
                    opt.disabled = (opt.value && opt.value === homeId);
                });
            });
        }
        // Add match form submission
        document.getElementById('add-match-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            let matchData;
            const modalMessage = document.getElementById('match-form-message');
            showLoading();
            if (editData) {
                // Only allow editing scores and status
                matchData = {
                    homeScore: parseInt(document.getElementById('addMatchHomeScore').value) || 0,
                    awayScore: parseInt(document.getElementById('addMatchAwayScore').value) || 0,
                    status: document.getElementById('addMatchStatus').value,
                };
            } else {
                const rawDate = document.getElementById('addMatchDate').value; // YYYY-MM-DD
                if (!rawDate) {
                    modalMessage.textContent = 'Date is required.';
                    modalMessage.className = 'mt-4 text-sm text-red-600';
                    hideLoading();
                    return;
                }
                const [yearFull, month, day] = rawDate.split('-');
                const formattedDate = `${day}-${month}-${yearFull}`; // Convert to DD-MM-YYYY for backend
                let rawTime = document.getElementById('addMatchTime').value; // 'HH:MM'
                let formattedTime = '';
                if (rawTime) {
                    let [hour, minute] = rawTime.split(':');
                    hour = parseInt(hour, 10);
                    let period = 'AM';
                    if (hour === 0) {
                        hour = 12;
                    } else if (hour === 12) {
                        period = 'PM';
                    } else if (hour > 12) {
                        hour -= 12;
                        period = 'PM';
                    }
                    formattedTime = `${String(hour).padStart(2, '0')}:${minute} ${period}`;
                }
                matchData = {
                    date: formattedDate, // Send as DD-MM-YYYY string
                    time: formattedTime, // Send as HH:MM AM/PM string
                    homeTeamId: document.getElementById('addMatchHomeTeamId').value,
                    homeScore: parseInt(document.getElementById('addMatchHomeScore').value) || 0,
                    awayTeamId: document.getElementById('addMatchAwayTeamId').value,
                    awayScore: parseInt(document.getElementById('addMatchAwayScore').value) || 0,
                    status: document.getElementById('addMatchStatus').value,
                };
            }
            try {
                if (editData && editData.id) {
                    await callAdminApi(submitApiEndpoint, 'PUT', matchData);
                    modalMessage.textContent = 'Match updated successfully!';
                } else {
                    await callAdminApi('matches', 'POST', matchData);
                    modalMessage.textContent = 'Match added successfully!';
                }
                modalMessage.className = 'mt-4 text-sm text-green-600';
                setTimeout(() => { hideLoading(); modalContainer.innerHTML = ''; updateMainContent(); }, 1200);
            } catch (error) {
                hideLoading();
                modalMessage.textContent = `Error: ${error.message}`;
                modalMessage.className = 'mt-4 text-sm px-4 text-red-600';
            }
        });
        return;
    }
}

// --- App Initialization & Event Listeners ---

// Listen for Firebase auth state changes
if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            renderAppLayout();
        } else {
            renderLoginPage();
        }
    });
}

// Global event listener for navigation and actions
if (app) {
    app.addEventListener('click', async (e) => {
        const target = e.target;
        // --- Sidebar Navigation ---
        if (target.closest('a[data-page]')) {
            e.preventDefault();
            const page = target.closest('a[data-page]').dataset.page;
            if (page && currentPage !== page) {
                currentPage = page;
                renderAppLayout();
            }
            return;
        }
        // --- Overview Card Clicks ---
        if (target.closest('[data-page]') && target.closest('.bg-white.p-6.rounded-lg.shadow-md.cursor-pointer')) {
            e.preventDefault();
            currentPage = target.closest('[data-page]').dataset.page;
            await updateMainContent();
        }
        // --- Logout Button ---
        if (target.id === 'logout-btn') {
            try {
                await firebase.auth().signOut();
                teamsCache = [];
                allPlayersCache = [];
            } catch (error) {
                alert('Error logging out: ' + error.message);
            }
        }
        // --- "Add Item" Buttons (to open modals) ---
        if (target.id === 'add-team-btn') {
            await showFormModal('team', getTeams, 'teams');
        }
        if (target.id === 'add-player-btn') {
            await showFormModal('player', getTeams, 'players');
        }
        if (target.id === 'add-match-btn') {
            await showFormModal('match', getTeams, 'matches');
        }
        if (target.id === 'add-news-btn') {
            await showFormModal('news', async () => [], 'news');
        }
        // --- "Edit Item" Buttons ---
        if (target.classList.contains('edit-team-btn')) {
            const id = target.dataset.id;
            let teams = teamsCache;
            if (!teams || teams.length === 0) {
                teams = await callAdminApi('teams');
            }
            const team = teams.find(t => t.id == id);
            if (team) {
                const editData = {
                    team_id: team.team_id || team.id,
                    LogoUrl: team.LogoUrl,
                    name: team.name,
                    name_mm: team.name_mm,
                    played: team.played,
                    won: team.won,
                    draw: team.draw,
                    lost: team.lost,
                    gf: team.gf,
                    ga: team.ga,
                    id: team.id
                };
                await showFormModal('team', getTeams, `teams/${team.id}`, editData);
            }
            return;
        }
        if (target.classList.contains('edit-player-btn')) {
            const id = target.dataset.id;
            let players = allPlayersCache;
            if (!players || players.length === 0) {
                players = await callAdminApi('players');
            }
            const player = players.find(p => p.id == id);
            if (player) {
                const editData = {
                    name: player.name,
                    name_en: player.name_en,
                    number: player.number,
                    team_id: player.team_id,
                    position: player.position,
                    imageUrl: player.imageUrl,
                    id: player.id
                };
                await showFormModal('player', getTeams, `players/${player.id}`, editData);
            }
            return;
        }
        if (target.classList.contains('edit-match-btn')) {
            const id = target.dataset.id;
            const matches = await callAdminApi('matches');
            const match = matches.find(m => m.id == id);
            if (match) {
                const editData = {
                    date: match.date,
                    time: match.time,
                    home_team: match.homeTeamId,
                    away_team: match.awayTeamId,
                    home_score: match.homeScore,
                    away_score: match.awayScore,
                    status: match.status,
                    id: match.id
                };
                await showFormModal('match', getTeams, `matches/${match.id}`, editData);
            }
            return;
        }
        if (target.classList.contains('edit-news-btn')) {
            const id = target.dataset.id;
            callAdminApi('news').then(newsList => {
                const newsItem = newsList.find(n => n.id == id);
                if (newsItem) {
                    showFormModal('news', async () => [], 'news', newsItem);
                }
            });
            return;
        }
    });
}

// --- Loading Animation Utility ---
function showLoading(targetSelector = 'body') {
    const target = document.querySelector(targetSelector) || document.body;
    let loader = target.querySelector('.inline-loading-spinner');
    if (!loader) {
        loader = document.createElement('div');
        loader.className = 'inline-loading-spinner flex justify-center items-center py-8';
        loader.innerHTML = `
            <span class="relative flex h-12 w-12 items-center justify-center">
                <span class="absolute inline-flex h-12 w-12 rounded-full bg-blue-400 opacity-30 animate-ping"></span>
                <span class="relative inline-flex h-12 w-12 items-center justify-center">
                    <span class="block h-12 w-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></span>
                </span>
            </span>
        `;
        target.appendChild(loader);
    }
}
function hideLoading(targetSelector = 'body') {
    const target = document.querySelector(targetSelector) || document.body;
    const loader = target.querySelector('.inline-loading-spinner');
    if (loader) loader.remove();
}
