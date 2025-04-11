function Cell(gameServer, owner, position, size) {
    this.gameServer = gameServer;
    this.owner = owner;     // playerTracker that owns this cell
    
    this.tickOfBirth = 0;
    this.color = { r: 0, g: 0, b: 0 };
    this.position = { x: 0, y: 0 };
    this._sizeSquared = 0;
    this._size = 0;
    this._mass = 0;
    this._speed = null;
    this.cellType = -1;     // 0 = Player Cell, 1 = Food, 2 = Virus, 3 = Ejected Mass
    this.isSpiked = false;  // If true, then this cell has spikes around it
    this.isAgitated = false;// If true, then this cell has waves on it's outline
    this.killedBy = null;   // Cell that ate this cell
    this.isMoving = false;  // Indicate that cell is in boosted mode
    
    this.boostDistance = 0;
    this.boostDirection = { x: 1, y: 0, angle: Math.PI / 2 };
    this.boostMaxSpeed = 78;// boost speed limit, sqrt(780*780/100)
    this.ejector = null;
    
    if (this.gameServer != null) {
        this.nodeId = this.gameServer.getNextNodeId();
        this.tickOfBirth = this.gameServer.tickCounter;
        if (size != null) {
            this.setSize(size);
        }
        if (position != null) {
            this.setPosition(position);
        }
    }
}

module.exports = Cell;

// Fields not defined by the constructor are considered private and need a getter/setter to access from a different class

Cell.prototype.setColor = function (color) {
    this.color.r = color.r;
    this.color.g = color.g;
    this.color.b = color.b;
};

Cell.prototype.setSize = function (size) {
    this._size = size;
    this._sizeSquared = size * size;
    this._mass = this._sizeSquared / 100;
    if (this.owner) 
        this.owner.isMassChanged = true;
};

Cell.prototype.getSpeed = function () {
    var speed = 2.1106 / Math.pow(this._size, 0.449);
    // tickStep = 40ms
    this._speed = (this.owner.customspeed > 0) ? 
    speed * 40 * this.owner.customspeed : // Set by command
    speed * 40 * this.gameServer.config.playerSpeed;
    return this._speed;
};

Cell.prototype.setAngle = function (angle) {
    this.boostDirection = {
        x: Math.sin(angle),
        y: Math.cos(angle),
        angle: angle
    };
};

// Returns cell age in ticks for specified game tick
Cell.prototype.getAge = function (tick) {
    if (this.tickOfBirth == null) return 0;
    return Math.max(0, tick - this.tickOfBirth);
};
Cell.prototype.getAge3 = function () {
    return this.gameServer.tickCounter - this.tickOfBirth;
};

Cell.prototype.setKiller = function (cell) {
    this.killedBy = cell;
};

Cell.prototype.setPosition = function (pos) {
    this.position.x = pos.x;
    this.position.y = pos.y;
};

// by default cell cannot eat anyone
Cell.prototype.canEat = function (cell) {
    return false;
};
Cell.prototype.getAge2 = function () {
    var age = this.getAge3() * 1000
    if(age % 2 != 0){this.hasEaten = false}
    if( this.hasEaten ) {
      return 0;
    }
    return this.gameServer.tickCounter - this.tickOfBirth
}
// Called to eat prey cell
Cell.prototype.onEat = function (prey, check) {
    if (!prey) return false; 
    const sizeIncreaseFactor = prey.cellType === 1 ? 8 : 1; 
    const newSize = Math.sqrt(this._sizeSquared + prey._sizeSquared * sizeIncreaseFactor); 
    this.setSize(newSize); 
    this.hasEaten = true; 
    clearTimeout(this.eatTimeout); 
    this.eatTimeout = setTimeout(() => {
        this.hasEaten = false;
    }, 0); 

    return true; 
};

Cell.prototype.onEaten = function (hunter) {
};

Cell.prototype.onAdd = function (gameServer) {
};

Cell.prototype.onRemove = function (gameServer) {
    return this.hasEaten = false
};

Cell.prototype.setBoost = function (distance, angle, cell) {
    this.boostDistance = distance;
    this.setAngle(angle);
    if(this.cellType === 0 ){ 
    this.isMoving = false;
    } else {
        this.isMoving =true
    }
    
    if (!this.owner) {
        var index = this.gameServer.movingNodes.indexOf(this);
        if (index < 0)
            this.gameServer.movingNodes.push(this);
    }
};

Cell.prototype.move = function (border) {
    if (this.isMoving && this.boostDistance <= 0) {
        this.boostDistance = 0;
        this.isMoving = false;
        return;
    }
    if(this.cellType === 0){
    if (this.isMoving && this.boostDirection.x < 1 && this.boostDirection.y < 1 && this.boostDirection.x > -1 && this.boostDirection.y > -1) {
        this.boostDirection.x=0;
		this.boostDirection.y=0;
        this.isMoving = true;
        return;
    }
}

    // add speed and set direction
    var speed = Math.sqrt(this.boostDistance * this.boostDistance / 100);
    this.boostDistance -= speed;
    this.position.x += this.boostDirection.x * speed;
    this.position.y += this.boostDirection.y * speed;
    
    // reflect off border
    var r = this._size / 2;
    if (this.position.x < border.minx + r || this.position.x > border.maxx - r) 
        this.boostDirection.x =- this.boostDirection.x;
	if (this.position.y < border.miny + r || this.position.y > border.maxy - r) 
	    this.boostDirection.y =- this.boostDirection.y;
	this.checkBorder(border);
};

Cell.prototype.checkBorder = function (border) {
    this.position.x = Math.max(this.position.x, border.minx + this._size / 2);
    this.position.y = Math.max(this.position.y, border.miny + this._size / 2);
    this.position.x = Math.min(this.position.x, border.maxx - this._size / 2);
    this.position.y = Math.min(this.position.y, border.maxy - this._size / 2);
};
