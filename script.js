document.addEventListener('DOMContentLoaded', () => {

    // ========================================================
    // 1) CONFIG & DATA
    // ========================================================
    
    const BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';
    const APP_ID = 'nfl-bingo-v1'; // Unique prefix to avoid collisions
    
    let client = null;
    let myId = 'user_' + Math.random().toString(36).substr(2, 9);
    let myName = '';
    let roomCode = '';
    let isHost = false;
    let amIConnected = false;
    
    // THE MASTER STATE (Host Authoritative)
    let gameState = {
        team: "None",
        players: {} // id -> { name, cardEvents, markedIndices, hasBingo }
    };

    // ========================================================
    // 2) EVENT DATA & TEAMS (From original code)
    // ========================================================
    
    const eventCategories = {
        offense: ["Touchdown", "Field Goal", "First Down", "Two-Point Conversion", "QB Scramble", "4th Down Attempt", "Over 20-Yard Pass", "Over 10-Yard Run", "3rd & Long (>10y)", "Screen Pass >10y", "Play Action", "QB Sneak", "Hail Mary", "Empty Backfield", "I-Formation", "Shotgun", "5+ Wide Receivers", "Lineman Eligible", "No Huddle", "Trick Play", "Fake Punt"],
        defense: ["Sack", "Tackle for Loss", "Pass Defended", "Tipped Pass", "QB Throws Away", "Interception", "Fumble", "Forced Fumble", "RB Fumble", "WR Fumble", "Turnover on Downs", "Defensive TD", "Goal Line Stand", "3-and-Out", "Red Zone FG Hold", "3rd Down Stop", "Kicker/Punter Tackle", "Muffed Punt", "Blocked Punt", "Defensive Points"],
        penalties: ["Penalty Flag", "Holding", "False Start", "Pass Interference", "Delay of Game", "Intentional Grounding", "Roughing Passer", "Unnecessary Roughness", "Face Mask", "Block in Back", "Running into Kicker", "Penalty Declined", "Penalty Accepted"],
        specialTeams: ["Punt", "Touchback", "Missed FG", "Onside Kick Try", "Successful Onside", "Special Teams TD", "Doink (Hit Post)"],
        gameManagement: ["Timeout", "2-Min Warning", "Score last 2 min", "Back-to-Back Timeouts", "Challenge Flag", "Challenge Won", "Challenge Lost", "Chain Measurement", "Overtime", "Injury Timeout", "Spiked Ball"],
        flavor: ["Coach Yelling", "Mascot", "Blimp Shot", "Sideline Reporter", "Rules Expert", "Face Paint Fan", "Shirtless Fan", "Truck Commercial", "Beer Commercial", "Announcers Disagree", "Helmet Throw", "Lip Read Profanity", "Cheerleader", "Celebrity", "Hurdle", "Juke Move", "Stiff Arm", "One-Handed Catch", "Dropped Pass", "Announcers on Cam"]
    };

    const teamColors = {
        "None": { primary: "#fca311", secondary: "#ffffff" },
        "ARI": { primary: "#97233F", secondary: "#000000" },
        "ATL": { primary: "#A71930", secondary: "#000000" },
        "BAL": { primary: "#241773", secondary: "#9E7C0C" },
        "BUF": { primary: "#00338D", secondary: "#C60C30" },
        "CAR": { primary: "#0085CA", secondary: "#000000" },
        "CHI": { primary: "#0B162A", secondary: "#C83803" },
        "CIN": { primary: "#FB4F14", secondary: "#000000" },
        "CLE": { primary: "#311D00", secondary: "#FF3C00" },
        "DAL": { primary: "#041E42", secondary: "#869397" },
        "DEN": { primary: "#FB4F14", secondary: "#002244" },
        "DET": { primary: "#0076B6", secondary: "#B0B7BC" },
        "GB": { primary: "#203731", secondary: "#FFB612" },
        "HOU": { primary: "#03202F", secondary: "#A71930" },
        "IND": { primary: "#002C5F", secondary: "#A2AAAD" },
        "JAX": { primary: "#006778", secondary: "#9F792C" },
        "KC": { primary: "#E31837", secondary: "#FFB81C" },
        "LV": { primary: "#000000", secondary: "#A5ACAF" },
        "LAC": { primary: "#0080C6", secondary: "#FFC20E" },
        "LAR": { primary: "#003594", secondary: "#FFD100" },
        "MIA": { primary: "#008E97", secondary: "#FC4C02" },
        "MIN": { primary: "#4F2683", secondary: "#FFC62F" },
        "NE": { primary: "#002244", secondary: "#C60C30" },
        "NO": { primary: "#D3BC8D", secondary: "#000000" },
        "NYG": { primary: "#0B2265", secondary: "#A71930" },
        "NYJ": { primary: "#125740", secondary: "#FFFFFF" },
        "PHI": { primary: "#004C54", secondary: "#A5ACAF" },
        "PIT": { primary: "#FFB612", secondary: "#101820" },
        "SF": { primary: "#AA0000", secondary: "#B3995D" },
        "SEA": { primary: "#002244", secondary: "#69BE28" },
        "TB": { primary: "#D50A0A", secondary: "#34302B" },
        "TEN": { primary: "#0C2340", secondary: "#4B92DB" },
        "WAS": { primary: "#5A1414", secondary: "#FFB612" }
    };

    const teamLogos = {
        // Reuse your logo paths here. Ideally host these on a public URL or keep local if distributing zip.
        // For this demo, I'll use placeholders if path fails, but keep your logic:
        ARI: "logos/arizona-cardinals.svg", ATL: "logos/atlanta-falcons.svg", BAL: "logos/baltimore-ravens.svg",
        BUF: "logos/buffalo-bills.svg", CAR: "logos/carolina-panthers.svg", CHI: "logos/chicago-bears.svg",
        CIN: "logos/cincinnati-bengals.svg", CLE: "logos/cleveland-browns.svg", DAL: "logos/dallas-cowboys.svg",
        DEN: "logos/denver-broncos.svg", DET: "logos/detroit-lions.svg", GB: "logos/green-bay-packers.svg",
        HOU: "logos/houston-texans.svg", IND: "logos/indianapolis-colts.svg", JAX: "logos/jacksonville-jaguars.svg",
        KC: "logos/kansas-city-chiefs.svg", LAC: "logos/los-angeles-chargers.svg", LAR: "logos/los-angeles-rams.svg",
        LV: "logos/oakland-raiders.svg", MIA: "logos/miami-dolphins.svg", MIN: "logos/minnesota-vikings.svg",
        NE: "logos/new-england-patriots.svg", NO: "logos/new-orleans-saints.svg", NYG: "logos/new-york-giants.svg",
        NYJ: "logos/new-york-jets.svg", PHI: "logos/philadelphia-eagles.svg", PIT: "logos/pittsburgh-steelers.svg",
        SF: "logos/san-francisco-49ers.svg", SEA: "logos/seattle-seahawks.svg", TB: "logos/tampa-bay-buccaneers.svg",
        TEN: "logos/tennessee-titans.svg", WAS: "logos/washington-commanders.svg"
    };

    const winningCombinations = [
        [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14],
        [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
        [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22],
        [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
        [0, 6, 12, 18, 24], [4, 8, 12, 16, 20]
    ];

    // ========================================================
    // 3) DOM ELEMENTS
    // ========================================================

    const lobbyScreen = document.getElementById('lobby-screen');
    const gameScreen = document.getElementById('game-screen');
    const usernameInput = document.getElementById('username');
    const createBtn = document.getElementById('create-btn');
    const joinBtn = document.getElementById('join-btn');
    const roomInput = document.getElementById('room-code-input');
    const connectionStatus = document.getElementById('connection-status');
    
    const currentRoomCode = document.getElementById('current-room-code');
    const hostControls = document.getElementById('host-controls');
    const teamSelect = document.getElementById('team-select');
    const newGameBtn = document.getElementById('new-game-btn');
    
    const myCardContainer = document.getElementById('my-card-container');
    const scoreboardContainer = document.getElementById('scoreboard-container');
    const scoreboardList = document.getElementById('scoreboard-list');
    const teamLogoImg = document.getElementById('team-logo');
    const playerCountSpan = document.getElementById('player-count');

    // Populate Team Select (Host only)
    Object.keys(teamColors).forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        teamSelect.appendChild(opt);
    });

    // ========================================================
    // 4) LOBBY LOGIC
    // ========================================================

    createBtn.addEventListener('click', () => {
        const name = usernameInput.value.trim() || 'Host';
        myName = name;
        isHost = true;
        roomCode = generateRoomCode();
        startGame();
    });

    joinBtn.addEventListener('click', () => {
        const name = usernameInput.value.trim();
        const code = roomInput.value.trim().toUpperCase();
        if (!name || !code) return alert("Enter name and room code");
        myName = name;
        roomCode = code;
        isHost = false;
        startGame();
    });

    function generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        return result;
    }

    function startGame() {
        lobbyScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        currentRoomCode.textContent = roomCode;
        
        if (isHost) {
            hostControls.classList.remove('hidden');
            scoreboardContainer.classList.remove('hidden');
            // Initialize Host State
            gameState.team = 'None';
            gameState.players = {}; 
            // Add Host as a player automatically
            addPlayerToState(myId, myName);
        } else {
            hostControls.classList.add('hidden');
        }

        connectToMqtt();
    }

    // ========================================================
    // 5) MQTT NETWORKING (The Core)
    // ========================================================

    function connectToMqtt() {
        connectionStatus.textContent = "Connecting...";
        client = mqtt.connect(BROKER_URL);
        const topic = `${APP_ID}/${roomCode}`;

        client.on('connect', () => {
            console.log("Connected to MQTT");
            connectionStatus.textContent = "Connected!";
            client.subscribe(topic);
            
            if (isHost) {
                // HOST: Heartbeat Loop (Broadcast state every 1s)
                setInterval(() => {
                    sendMqtt({ type: 'STATE', state: gameState });
                }, 1000);
            } else {
                // CLIENT: Join Loop (Knock until answered)
                const joinInterval = setInterval(() => {
                    if (amIConnected) {
                        clearInterval(joinInterval);
                    } else {
                        sendMqtt({ type: 'JOIN', name: myName });
                    }
                }, 2000);
            }
        });

        client.on('message', (topic, message) => {
            const payload = JSON.parse(message.toString());
            if (payload.senderId === myId) return; // Ignore own messages

            if (isHost) {
                handleHostMessages(payload);
            } else {
                handleClientMessages(payload);
            }
        });
    }

    function sendMqtt(data) {
        if (!client) return;
        data.senderId = myId;
        client.publish(`${APP_ID}/${roomCode}`, JSON.stringify(data));
    }

    // ========================================================
    // 6) MESSAGE HANDLING
    // ========================================================

    function handleHostMessages(data) {
        // Client asking to join
        if (data.type === 'JOIN') {
            if (!gameState.players[data.senderId]) {
                addPlayerToState(data.senderId, data.name);
            }
        }
        // Client clicked a square
        if (data.type === 'CLICK') {
            const pid = data.senderId;
            const idx = data.index;
            if (gameState.players[pid]) {
                const p = gameState.players[pid];
                // Toggle mark
                if (p.markedIndices.includes(idx)) {
                    p.markedIndices = p.markedIndices.filter(i => i !== idx);
                } else {
                    p.markedIndices.push(idx);
                }
                // Check Bingo
                p.hasBingo = checkBingo(p.markedIndices);
            }
        }
    }

    function handleClientMessages(data) {
        if (data.type === 'STATE') {
            amIConnected = true; // We heard the host!
            const serverState = data.state;
            renderGame(serverState);
        }
    }

    // ========================================================
    // 7) GAME LOGIC (Host-Side)
    // ========================================================

    function addPlayerToState(id, name) {
        gameState.players[id] = {
            name: name,
            cardEvents: generateCardEvents(),
            markedIndices: [12], // Free space
            hasBingo: false
        };
    }

    function generateCardEvents() {
        // Logic from original script
        const distribution = { offense: 6, defense: 6, penalties: 3, specialTeams: 2, gameManagement: 2, flavor: 5 };
        let selected = [];
        Object.entries(distribution).forEach(([cat, count]) => {
            const pool = eventCategories[cat] || [];
            const shuffled = [...pool].sort(() => Math.random() - 0.5);
            selected = selected.concat(shuffled.slice(0, Math.min(count, pool.length)));
        });
        // Fill if short
        if (selected.length < 24) {
            const all = Object.values(eventCategories).flat();
            const rem = all.filter(e => !selected.includes(e));
            selected = selected.concat(rem.sort(() => Math.random() - 0.5).slice(0, 24 - selected.length));
        }
        // Shuffle final 24
        const final = selected.sort(() => Math.random() - 0.5);
        // Insert FREE SPACE at index 12 later in render, but logic expects 24 items usually
        // Actually, let's store 25 items for easier index matching.
        // Insert "FREE SPACE" at index 12
        final.splice(12, 0, "FREE SPACE");
        return final;
    }

    function checkBingo(markedIndices) {
        for (const combo of winningCombinations) {
            if (combo.every(idx => markedIndices.includes(idx))) {
                return true;
            }
        }
        return false;
    }

    // Host Controls
    teamSelect.addEventListener('change', () => {
        gameState.team = teamSelect.value;
    });

    newGameBtn.addEventListener('click', () => {
        if(confirm("Reset game and generate new cards for everyone?")) {
            Object.keys(gameState.players).forEach(pid => {
                gameState.players[pid].cardEvents = generateCardEvents();
                gameState.players[pid].markedIndices = [12];
                gameState.players[pid].hasBingo = false;
            });
        }
    });

    // ========================================================
    // 8) RENDER LOGIC (Client-Side)
    // ========================================================

    function renderGame(serverState) {
        // Update Team Colors
        const team = serverState.team;
        const colors = teamColors[team] || teamColors["None"];
        document.documentElement.style.setProperty('--card-primary-color', colors.primary);
        document.documentElement.style.setProperty('--card-secondary-color', colors.secondary);
        
        if (teamLogos[team]) {
            teamLogoImg.src = teamLogos[team];
            teamLogoImg.classList.remove('hidden');
        } else {
            teamLogoImg.classList.add('hidden');
        }

        // My Data
        const myData = serverState.players[myId];
        if (!myData) return; // Not fully joined yet

        renderMyCard(myData);

        // Stats
        const pIds = Object.keys(serverState.players);
        playerCountSpan.textContent = `Players: ${pIds.length}`;

        // Host Scoreboard
        if (isHost) {
            renderScoreboard(serverState.players);
        }
    }

    function renderMyCard(playerData) {
        // Idempotent render: Only rebuild if empty, otherwise update classes
        let grid = document.querySelector('.bingo-grid');
        
        if (!grid) {
            myCardContainer.innerHTML = '';
            const card = document.createElement('div');
            card.className = 'bingo-card';
            
            // Header
            const header = document.createElement('div');
            header.className = 'card-header';
            header.innerHTML = `<span>${playerData.name}</span>`;
            card.appendChild(header);

            grid = document.createElement('div');
            grid.className = 'bingo-grid';
            
            // Build Squares
            playerData.cardEvents.forEach((evtText, i) => {
                const sq = document.createElement('div');
                sq.className = 'bingo-square';
                sq.dataset.index = i;
                sq.textContent = evtText;
                if (i === 12) sq.classList.add('free-space');
                
                sq.addEventListener('click', () => {
                    if (i === 12) return; // Don't unclick free space
                    sendMqtt({ type: 'CLICK', index: i });
                });
                
                grid.appendChild(sq);
            });
            card.appendChild(grid);
            myCardContainer.appendChild(card);
        }

        // Update Classes based on markedIndices
        const squares = grid.querySelectorAll('.bingo-square');
        squares.forEach(sq => {
            const idx = parseInt(sq.dataset.index);
            if (playerData.markedIndices.includes(idx)) {
                sq.classList.add('marked');
            } else {
                sq.classList.remove('marked');
            }
        });

        // Bingo Alert?
        if (playerData.hasBingo) {
            // Could add visual flair here
            document.querySelector('.card-header').style.backgroundColor = '#28a745';
            document.querySelector('.card-header span').textContent = `${playerData.name} - BINGO! 🎉`;
        } else {
             document.querySelector('.card-header span').textContent = playerData.name;
             document.querySelector('.card-header').style.backgroundColor = ''; // reset to variable
        }
    }

    function renderScoreboard(players) {
        scoreboardList.innerHTML = '';
        Object.values(players).forEach(p => {
            const row = document.createElement('div');
            row.className = 'score-row';
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.padding = '5px';
            row.style.borderBottom = '1px solid #ddd';
            
            const squaresMarked = p.markedIndices.length - 1; // minus free space
            let txt = `${p.name}: ${squaresMarked} events`;
            if (p.hasBingo) txt += " 🏆 BINGO!";
            
            row.textContent = txt;
            if (p.hasBingo) row.style.fontWeight = 'bold';
            row.style.color = p.hasBingo ? 'green' : 'inherit';
            
            scoreboardList.appendChild(row);
        });
    }

});