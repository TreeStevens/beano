document.addEventListener('DOMContentLoaded', () => {

    const BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';
    const APP_ID = 'nfl-bingo-v2'; // Changed version to prevent cached conflicts

    let client = null;
    let myId = 'user_' + Math.random().toString(36).substr(2, 9);
    let myName = '';
    let roomCode = '';
    let isHost = false;
    let amIConnected = false;

    // ========================================================
    // 1) MASTER STATE
    // ========================================================
    
    // Default config
    let hostConfig = {
        cardsPerPlayer: 1
    };

    let gameState = {
        team: "None",
        config: hostConfig,
        // Players now map to: { name, cards: [ { events, markedIndices, hasBingo } ] }
        players: {} 
    };

    // ========================================================
    // 2) DATA SETS
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
    const cardsCountInput = document.getElementById('cards-count-input'); // New Input

    const currentRoomCode = document.getElementById('current-room-code');
    const hostControls = document.getElementById('host-controls');
    const teamSelect = document.getElementById('team-select');
    const newGameBtn = document.getElementById('new-game-btn');
    
    const myCardContainer = document.getElementById('my-card-container');
    const scoreboardContainer = document.getElementById('scoreboard-container');
    const scoreboardList = document.getElementById('scoreboard-list');
    const teamLogoImg = document.getElementById('team-logo');
    const playerCountSpan = document.getElementById('player-count');

    // Populate Team Select
    Object.keys(teamColors).forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        teamSelect.appendChild(opt);
    });

    // ========================================================
    // 4) LOBBY & START
    // ========================================================

    createBtn.addEventListener('click', () => {
        const name = usernameInput.value.trim() || 'Host';
        // READ THE CONFIG
        const count = parseInt(cardsCountInput.value) || 1;
        
        myName = name;
        isHost = true;
        roomCode = generateRoomCode();
        
        hostConfig.cardsPerPlayer = Math.min(4, Math.max(1, count));
        gameState.config = hostConfig;

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
            gameState.players = {};
            addPlayerToState(myId, myName);
        }

        connectToMqtt();
    }

    // ========================================================
    // 5) MQTT CONNECTION
    // ========================================================

    function connectToMqtt() {
        connectionStatus.textContent = "Connecting...";
        client = mqtt.connect(BROKER_URL);
        const topic = `${APP_ID}/${roomCode}`;

        client.on('connect', () => {
            connectionStatus.textContent = "Connected!";
            client.subscribe(topic);
            
            if (isHost) {
                // HOST HEARTBEAT
                setInterval(() => {
                    sendMqtt({ type: 'STATE', state: gameState });
                }, 1000);
            } else {
                // CLIENT JOIN LOOP
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
            if (payload.senderId === myId) return;

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
        if (data.type === 'JOIN') {
            if (!gameState.players[data.senderId]) {
                addPlayerToState(data.senderId, data.name);
            }
        }
        if (data.type === 'CLICK') {
            // Data needed: senderId, cardIndex, squareIndex
            const p = gameState.players[data.senderId];
            if (p && p.cards[data.cardIndex]) {
                const targetCard = p.cards[data.cardIndex];
                const idx = data.squareIndex;
                
                // Toggle Mark
                if (targetCard.markedIndices.includes(idx)) {
                    targetCard.markedIndices = targetCard.markedIndices.filter(i => i !== idx);
                } else {
                    targetCard.markedIndices.push(idx);
                }
                
                // Check Bingo for THIS card
                targetCard.hasBingo = checkBingo(targetCard.markedIndices);
            }
        }
    }

    function handleClientMessages(data) {
        if (data.type === 'STATE') {
            amIConnected = true;
            renderGame(data.state);
        }
    }

    // ========================================================
    // 7) GAME LOGIC (HOST)
    // ========================================================

    function addPlayerToState(id, name) {
        const numCards = gameState.config.cardsPerPlayer;
        const playerCards = [];

        for (let i = 0; i < numCards; i++) {
            playerCards.push({
                events: generateCardEvents(),
                markedIndices: [12], // Free space
                hasBingo: false
            });
        }

        gameState.players[id] = {
            name: name,
            cards: playerCards
        };
    }

    function generateCardEvents() {
        const distribution = { offense: 6, defense: 6, penalties: 3, specialTeams: 2, gameManagement: 2, flavor: 5 };
        let selected = [];
        Object.entries(distribution).forEach(([cat, count]) => {
            const pool = eventCategories[cat] || [];
            const shuffled = [...pool].sort(() => Math.random() - 0.5);
            selected = selected.concat(shuffled.slice(0, Math.min(count, pool.length)));
        });
        if (selected.length < 24) {
            const all = Object.values(eventCategories).flat();
            const rem = all.filter(e => !selected.includes(e));
            selected = selected.concat(rem.sort(() => Math.random() - 0.5).slice(0, 24 - selected.length));
        }
        const final = selected.sort(() => Math.random() - 0.5);
        final.splice(12, 0, "FREE SPACE");
        return final;
    }

    function checkBingo(markedIndices) {
        for (const combo of winningCombinations) {
            if (combo.every(idx => markedIndices.includes(idx))) return true;
        }
        return false;
    }

    teamSelect.addEventListener('change', () => {
        gameState.team = teamSelect.value;
    });

    newGameBtn.addEventListener('click', () => {
        if(confirm("Reset game?")) {
            Object.keys(gameState.players).forEach(pid => {
                const p = gameState.players[pid];
                // Regenerate all cards for this player
                p.cards.forEach(c => {
                    c.events = generateCardEvents();
                    c.markedIndices = [12];
                    c.hasBingo = false;
                });
            });
        }
    });

    // ========================================================
    // 8) RENDER LOGIC (CLIENT)
    // ========================================================

    function renderGame(serverState) {
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

        // Render My Cards
        const myData = serverState.players[myId];
        if (myData) {
            renderAllMyCards(myData);
        }

        // Update Counts
        const pIds = Object.keys(serverState.players);
        playerCountSpan.textContent = `Players: ${pIds.length}`;

        // Update Scoreboard (Host View)
        if (isHost) {
            renderScoreboard(serverState.players);
        }
    }

    function renderAllMyCards(playerData) {
        // Ensure we have the right number of card DOM elements
        const cardCount = playerData.cards.length;
        const currentDomCards = myCardContainer.querySelectorAll('.bingo-card');

        // If the number of cards changed (or init), rebuild DOM
        if (currentDomCards.length !== cardCount) {
            myCardContainer.innerHTML = '';
            playerData.cards.forEach((cardData, index) => {
                myCardContainer.appendChild(createCardDOM(playerData.name, index, cardData));
            });
        }

        // Update States (Classes) for all cards
        const domCards = myCardContainer.querySelectorAll('.bingo-card');
        playerData.cards.forEach((cardData, cIndex) => {
            const cardEl = domCards[cIndex];
            const squares = cardEl.querySelectorAll('.bingo-square');
            
            // Update squares
            squares.forEach(sq => {
                const sIdx = parseInt(sq.dataset.sqIndex);
                if (cardData.markedIndices.includes(sIdx)) {
                    sq.classList.add('marked');
                } else {
                    sq.classList.remove('marked');
                }
            });

            // Update Header for Bingo
            const headerSpan = cardEl.querySelector('.card-header span');
            if (cardData.hasBingo) {
                cardEl.querySelector('.card-header').classList.add('bingo-active');
                headerSpan.textContent = `${playerData.name} #${cIndex+1} - BINGO!`;
            } else {
                cardEl.querySelector('.card-header').classList.remove('bingo-active');
                headerSpan.textContent = `${playerData.name} #${cIndex+1}`;
            }
        });
    }

    function createCardDOM(playerName, cardIndex, cardData) {
        const card = document.createElement('div');
        card.className = 'bingo-card';
        card.dataset.cardIndex = cardIndex;

        const header = document.createElement('div');
        header.className = 'card-header';
        header.innerHTML = `<span>${playerName} #${cardIndex+1}</span>`;
        card.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'bingo-grid';

        cardData.events.forEach((text, sqIndex) => {
            const sq = document.createElement('div');
            sq.className = 'bingo-square';
            sq.dataset.sqIndex = sqIndex; // which square is this?
            sq.textContent = text;
            if (sqIndex === 12) sq.classList.add('free-space');

            sq.addEventListener('click', () => {
                if (sqIndex === 12) return;
                // Send Card Index AND Square Index
                sendMqtt({ type: 'CLICK', cardIndex: cardIndex, squareIndex: sqIndex });
            });
            grid.appendChild(sq);
        });

        card.appendChild(grid);
        return card;
    }

    function renderScoreboard(players) {
        scoreboardList.innerHTML = '';
        Object.values(players).forEach(p => {
            let totalBingos = 0;
            let totalMarks = 0;
            p.cards.forEach(c => {
                if(c.hasBingo) totalBingos++;
                totalMarks += (c.markedIndices.length - 1);
            });

            const row = document.createElement('div');
            row.className = 'score-row';
            
            let txt = `${p.name}: ${totalMarks} marks`;
            if (totalBingos > 0) {
                txt += ` | 🏆 ${totalBingos} BINGO(S)!`;
                row.style.fontWeight = 'bold';
                row.style.color = 'green';
            }
            row.textContent = txt;
            scoreboardList.appendChild(row);
        });
    }
});