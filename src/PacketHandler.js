var pjson = require('../package.json');
var Packet = require('./packet');
var BinaryReader = require('./packet/BinaryReader');

function PacketHandler(gameServer, socket) {
    this.gameServer = gameServer;
    this.socket = socket;
    this.protocol = 0;
    this.handshakeProtocol = null;
    this.handshakeKey = null;
    this.lastJoinTick = 0;
    this.lastChatTick = 0;
    this.lastStatTick = 0;
    this.lastWTick = 0;
    this.lastRTick = 0;
    this.lastQTick = 0;
    this.lastSpaceTick = 0;
    
    this.pressQ = false;
    this.pressW = false;
    this.pressSpace = false;
    this.mouseData = null;
 
    this.handler = {
        254: this.handshake_onProtocol.bind(this),
    };
}

module.exports = PacketHandler;

PacketHandler.prototype.handleMessage = function (message) {
    if (!this.handler.hasOwnProperty(message[0])) {
        return;
    }
    this.handler[message[0]](message);
    this.socket.lastAliveTime = this.gameServer.stepDateTime;
};

PacketHandler.prototype.handshake_onProtocol = function (message) {
    if (message.length !== 5) return;
    this.handshakeProtocol = message[1] | (message[2] << 8) | (message[3] << 16) | (message[4] << 24);
    if (this.handshakeProtocol < 1 || this.handshakeProtocol > 9) {
        this.socket.close(1002, "Not supported protocol");
        return;
    }
    this.handler = {
        255: this.handshake_onKey.bind(this),
    };
};

PacketHandler.prototype.handshake_onKey = function (message) {
    if (message.length !== 5) return;
    this.handshakeKey = message[1] | (message[2] << 8) | (message[3] << 16) | (message[4] << 24);
    if (this.handshakeProtocol > 6 && this.handshakeKey !== 0) {
        this.socket.close(1002, "Not supported protocol");
        return;
    }
    this.handshake_onCompleted(this.handshakeProtocol, this.handshakeKey);
};

PacketHandler.prototype.handshake_onCompleted = function (protocol, key) {
    this.handler = {
        0: this.message_onJoin.bind(this),
        1: this.message_onSpectate.bind(this),
        16: this.message_onMouse.bind(this),
        17: this.message_onKeySpace.bind(this),
        18: this.message_onKeyQ.bind(this),
        21: this.message_onKeyW.bind(this),
        22: this.message_onKeyE.bind(this),
        23: this.message_onKeyR.bind(this),
        24: this.message_onKeyT.bind(this),
        99: this.message_onChat.bind(this),
        254: this.message_onStat.bind(this),
    };
    this.protocol = protocol;
    // Send handshake response
    this.socket.sendPacket(new Packet.ClearAll());
    this.socket.sendPacket(new Packet.SetBorder(this.socket.playerTracker, this.gameServer.border, this.gameServer.config.serverGamemode, "MultiOgar-Edited " + pjson.version));
    // Send welcome message
    this.gameServer.sendChatMessage(null, this.socket.playerTracker, "MultiOgar-Edited " + pjson.version);
    if (this.gameServer.config.serverWelcome1)
        this.gameServer.sendChatMessage(null, this.socket.playerTracker, this.gameServer.config.serverWelcome1);
    if (this.gameServer.config.serverWelcome2)
        this.gameServer.sendChatMessage(null, this.socket.playerTracker, this.gameServer.config.serverWelcome2);
    if (this.gameServer.config.serverChat == 0)
        this.gameServer.sendChatMessage(null, this.socket.playerTracker, "This server's chat is disabled.");
    if (this.protocol < 4)
        this.gameServer.sendChatMessage(null, this.socket.playerTracker, "WARNING: Protocol " + this.protocol + " assumed as 4!");
};


PacketHandler.prototype.message_onJoin = function (message) {
    var tick = this.gameServer.tickCounter;
    var dt = tick - this.lastJoinTick;
    this.lastJoinTick = tick;
    if (dt < 25 || this.socket.playerTracker.cells.length !== 0) {
        return;
    }
    var reader = new BinaryReader(message);
    reader.skipBytes(1);
    var text = null;
    if (this.protocol < 6)
        text = reader.readStringZeroUnicode();
    else
        text = reader.readStringZeroUtf8();
    this.setNickname(text);
};

PacketHandler.prototype.message_onSpectate = function (message) {
    if (message.length !== 1 || this.socket.playerTracker.cells.length !== 0) {
        return;
    }
    this.socket.playerTracker.spectate = true;
};

PacketHandler.prototype.message_onMouse = function (message) {
    if (message.length !== 13 && message.length !== 9 && message.length !== 21) {
        return;
    }
    this.mouseData = Buffer.concat([message]);
};

PacketHandler.prototype.message_onKeySpace = function (message) {

    if (message.length === 1 || message.length === 2) {
        var splitCount = message[1];
        if (splitCount) {
            for (var i = 0; i < splitCount; i++) {
                this.socket.playerTracker.pressSpace();
            }
        } else {
            this.socket.playerTracker.pressSpace();
        }
    } else {
        return
    }
	/*
    var tick = this.gameServer.getTick();
    var dt = tick - this.lastSpaceTick;
    if (dt < this.gameServer.config.ejectCooldown) {
        return;
    }
    this.lastSpaceTick = tick;
	
    this.pressSpace = true;*/
};

PacketHandler.prototype.message_onKeyQ = function (message) {
    if (message.length !== 1) return;
    var tick = this.gameServer.tickCoutner;
    var dt = tick - this.lastQTick;
    if (dt < this.gameServer.config.ejectCooldown) {
        return;
    }
    this.lastQTick = tick;
    
    // client has minions
    var client = this.socket.playerTracker;
    var color = this.gameServer.getGrayColor(client.color);
    var randomColor = this.gameServer.getRandomColor(client.color);
    if (client.minionControl) {
        if (client.miQ == 1) {
            client.miQ = 0;
            client.setColor(randomColor);
            client.cells.forEach(function (cell) {
                cell.setColor(randomColor);
            }, this);
        } else {
            client.miQ = 1;
            client.setColor(color);
            client.setSkin("");
            client.cells.forEach(function (cell) {
                cell.setColor(color);
            }, this);
        }
        
    // client doesn't have minions
    } else {
        this.pressQ = true;
    }
};

PacketHandler.prototype.message_onKeyW = function (message) {
    if (message.length !== 1) return;
    var tick = this.gameServer.tickCounter;
    var dt = tick - this.lastWTick;
    if (dt < this.gameServer.config.ejectCooldown) {
        return;
    }
    this.lastWTick = tick;
    
    // minion eject
    var player = this.socket.playerTracker;
    if (player.miQ == 1 && player.minionControl) {
        for (var i in this.gameServer.clients) {
            var client = this.gameServer.clients[i].playerTracker;
            if (client.isMi && client.owner == player) {
                this.gameServer.ejectMass(client);
            }
        }
    // player eject
    } else {
        this.pressW = true;
    }
};

PacketHandler.prototype.message_onKeyE = function (message) {
    if (this.gameServer.config.disableERT === 1) return;
    
    // minion split
    var player = this.socket.playerTracker;
    for (var i in this.gameServer.clients) {
        var client = this.gameServer.clients[i].playerTracker;
        if (client.isMi && client.owner == player) { 
            this.gameServer.splitCells(client);
        }
    }
};

PacketHandler.prototype.message_onKeyR = function (message) {
    if (this.gameServer.config.disableERT === 1) return;
    
    if (message.length !== 1) return;
    var tick = this.gameServer.tickCounter;
    var dt = tick - this.lastRTick;
    if (dt < this.gameServer.config.ejectCooldown) {
        return;
    }
    this.lastRTick = tick;
    
    // minion eject
    var player = this.socket.playerTracker;
    for (var i in this.gameServer.clients) {
        var client = this.gameServer.clients[i].playerTracker;
        if (client.isMi && client.owner == player) {
            this.gameServer.ejectMass(client);
        }
    }
};

PacketHandler.prototype.message_onKeyT = function (message) {
    if (this.gameServer.config.disableERT === 1) return;
    
    // freeze minions
    var player = this.socket.playerTracker;
    player.minionFrozen = !player.minionFrozen;
    for (var i in this.gameServer.clients) {
        var client = this.gameServer.clients[i].playerTracker;
        if (client.isMi && client.owner == player) {
            client.frozen = player.minionFrozen;
        }
    }
};

PacketHandler.prototype.message_onChat = function (message) {
    if (message.length < 3) return;
    var tick = this.gameServer.tickCounter;
    var dt = tick - this.lastChatTick;
    this.lastChatTick = tick;
    if (dt < 25 * 2) {
        return;
    }
    
    var flags = message[1];    // flags
    var rvLength = (flags & 2 ? 4:0) + (flags & 4 ? 8:0) + (flags & 8 ? 16:0);
    if (message.length < 3 + rvLength) // second validation
        return;
    
    var reader = new BinaryReader(message);
    reader.skipBytes(2 + rvLength);     // reserved
    var text = null;
    if (this.protocol < 6)
        text = reader.readStringZeroUnicode();
    else
        text = reader.readStringZeroUtf8();
    this.gameServer.onChatMessage(this.socket.playerTracker, null, text);
};

PacketHandler.prototype.message_onStat = function (message) {
    if (message.length !== 1) return;
    var tick = this.gameServer.tickCounter;
    var dt = tick - this.lastStatTick;
    this.lastStatTick = tick;
    if (dt < 25) {
        return;
    }
    this.socket.sendPacket(new Packet.ServerStat(this.socket.playerTracker));
};

PacketHandler.prototype.processMouse = function () {
    if (this.mouseData == null) return;
    var client = this.socket.playerTracker;
    var reader = new BinaryReader(this.mouseData);
    reader.skipBytes(1);
    if (this.mouseData.length === 13) {
        // protocol late 5, 6, 7
        client.mouse.x = reader.readInt32() - client.scrambleX;
        client.mouse.y = reader.readInt32() - client.scrambleY;
    } else if (this.mouseData.length === 9) {
        // early protocol 5
        client.mouse.x = reader.readInt16() - client.scrambleX;
        client.mouse.y = reader.readInt16() - client.scrambleY;
    } else if (this.mouseData.length === 21) {
        // protocol 4
        var x = reader.readDouble() - client.scrambleX;
        var y = reader.readDouble() - client.scrambleY;
        if (!isNaN(x) && !isNaN(y)) {
            client.mouse.x = x;
            client.mouse.y = y;
        }
    }
    this.mouseData = null;
};

PacketHandler.prototype.process = function () {
    if (this.pressSpace) { // Split cell
        this.socket.playerTracker.pressSpace();
        this.pressSpace = false;
    }
    if (this.pressW) { // Eject mass
        this.socket.playerTracker.pressW();
        this.pressW = false;
    }
    if (this.pressQ) { // Q Press
        this.socket.playerTracker.pressQ();
        this.pressQ = false;
    }
    this.processMouse();
};

PacketHandler.prototype.getRandomSkin = function () {
    var randomSkins = [];
    var fs = require("fs");
    
    if (fs.existsSync("./randomskins.txt")) {
        // Read and parse the Skins - filter out whitespace-only Skins
        randomSkins = fs.readFileSync("./randomskins.txt", "utf8").split(/[\r\n]+/).filter(function (x) {
            return x != ''; // filter empty Skins
        });
    }
    
    // Picks a random skin
    if (randomSkins.length > 0) {
        var index = (randomSkins.length * Math.random()) >>> 0;
        var rSkin = randomSkins[index];
    }
    
    return rSkin;
};

PacketHandler.prototype.setNickname = function (text) {
    var name = "";
    var skin = null;
    if (text != null && text.length > 0) {
        var skinName = null;
        var userName = text;
        var n = -1;
        if (text[0] == '<' && (n = text.indexOf('>', 1)) >= 1) {
            var inner = text.slice(1, n);
            if (n > 1) {
                skinName = (inner == "r") ? "%" + this.getRandomSkin() : "%" + inner;
            } else {
                skinName = "";
            }
            userName = text.slice(n + 1);
        }
        skin = skinName;
        name = userName;
    }
    if (name.length > this.gameServer.config.playerMaxNickLength) {
        name = name.substring(0, this.gameServer.config.playerMaxNickLength);
    }
    if (this.gameServer.checkBadWord(name)) {
        skin = null;
        name = "Hi there!";
    }
    this.socket.playerTracker.joinGame(name, skin);
};
