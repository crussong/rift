"use strict";

/**
 * @brief generates polyhedral dice with roll animation and result calculation
 * @author Anton Natarov aka Teal (original author)
 * @author Sarah Rosanna Busch (refactor, see changelog)
 * @date 10 Aug 2023
 * @version 1.1
 * @dependencies teal.js, cannon.js, three.js
 */

/**
 * CHANGELOG
 * - tweaked scaling to make dice look nice on mobile
 * - removed dice selector feature (separating UI from dice roller)
 * - file reorg (moving variable declarations to top, followed by public then private functions)
 * - removing true random option (was cool but not worth the extra dependencies or complexity)
 * - removing mouse event bindings (separating UI from dice roller)
 * - refactoring to module pattern and reducing publically available properties/methods
 * - removing dice notation getter callback in favour of setting dice to roll directly
 * - adding sound effect
 * - adding roll results to notation returned in after_roll callback
 * - adding 'd9' option (d10 to be added to d100 properly)
 */

const DICE = (function() {
    var that = {};

    var vars = { //todo: make these configurable on init
        frame_rate: 1 / 60,
        scale: 100, //dice size
        
        material_options: {
            specular: 0x172022,
            color: 0xf0f0f0,
            shininess: 40,
            shading: THREE.FlatShading,
            emissive: 0x000000
        },
        label_color: '#ffffff', //RIFT: white labels
        // RIFT: Dynamic label color based on background brightness
        label_color_dark: '#1a1a1a',
        dice_color: '#2a2a2a', // RIFT: Dunkelgrau als Basis
        // RIFT: Gradient Support
        dice_gradient: null, // { type: 'linear'|'radial', colors: ['#color1', '#color2', ...], stops: [0, 0.5, 1] }
        // RIFT: Texture Support
        dice_texture: null, // { type: 'marble'|'wood'|'stone'|'leather'|'metal', baseColor: '#...', veinColor/grainColor/speckleColor: '#...' }
        // RIFT: Glow & Effects
        dice_material_override: null, // { shininess, specular, emissive } - per-theme material overrides
        dice_text_style: null, // 'embossed', 'neon', 'metallic', 'outline' or null
        dice_neon_color: null, // Neon glow color for text
        dice_text_color2: null, // Secondary text color (gradient end, stroke, etc.)
        dice_glow: false,
        dice_glow_color: null, // null = use dice color
        dice_glow_intensity: 2.0, // PointLight intensity
        dice_glow_distance: 300, // Licht-Reichweite
        dice_pulse: false,
        dice_pulse_speed: 2, // pulses per second
        dice_pulse_min: 0.5,
        dice_pulse_max: 2.5,
        ambient_light_color: 0xf0f0f0,
        spot_light_color: 0xefefef,
        desk_color: '#101010', //canvas background
        desk_opacity: 0, //RIFT: transparent background
        use_shadows: true,
        use_adapvite_timestep: true //todo: setting this to false improves performace a lot. but the dice rolls don't look as natural...

    }

    const CONSTS = {
        known_types: ['d4', 'd6', 'd8', 'd9', 'd10', 'd12', 'd20', 'd100'],
        dice_face_range: { 'd4': [1, 4], 'd6': [1, 6], 'd8': [1, 8], 'd9': [0, 9], 'd10': [0, 9], 
            'd12': [1, 12], 'd20': [1, 20], 'd100': [0, 9] },
        dice_mass: { 'd4': 300, 'd6': 300, 'd8': 340, 'd9': 350, 'd10': 350, 'd12': 350, 'd20': 400, 'd100': 350 },
        dice_inertia: { 'd4': 5, 'd6': 13, 'd8': 10, 'd9': 9, 'd10': 9, 'd12': 8, 'd20': 6, 'd100': 9 },
        
        standart_d20_dice_face_labels: [' ', '0', '1', '2', '3', '4', '5', '6', '7', '8',
                '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'],
        standart_d100_dice_face_labels: [' ', '00', '10', '20', '30', '40', '50',
                '60', '70', '80', '90'],
                
        d4_labels: [
            [[], [0, 0, 0], [2, 4, 3], [1, 3, 4], [2, 1, 4], [1, 2, 3]],
            [[], [0, 0, 0], [2, 3, 4], [3, 1, 4], [2, 4, 1], [3, 2, 1]],
            [[], [0, 0, 0], [4, 3, 2], [3, 4, 1], [4, 2, 1], [3, 1, 2]],
            [[], [0, 0, 0], [4, 2, 3], [1, 4, 3], [4, 1, 2], [1, 3, 2]]
        ]
    }

    // DICE BOX OBJECT

    // @brief constructor; create a new instance of this to initialize the canvas
    // @param container element to contain canvas; canvas will fill container
    that.dice_box = function(container) {
        this.dices = [];
        this.scene = new THREE.Scene();
        this.world = new CANNON.World();
        this.diceToRoll = ''; //user input
        this.container = container;

        this.renderer = window.WebGLRenderingContext
            ? new THREE.WebGLRenderer({ antialias: true, alpha: true })
            : new THREE.CanvasRenderer({ antialias: true, alpha: true });
        container.appendChild(this.renderer.domElement);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x000000, 0); //RIFT: black fallback if alpha fails (prevents white flash on mobile)

        this.reinit(container);
        $t.bind(container, 'resize', function() {
            //todo: this doesn't work :(
            this.reinit(elem.canvas);
        });

        this.world.gravity.set(0, 0, -9.8 * 800);
        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.solver.iterations = 16;

        var ambientLight = new THREE.AmbientLight(vars.ambient_light_color);
        this.scene.add(ambientLight);

        this.dice_body_material = new CANNON.Material();
        var desk_body_material = new CANNON.Material();
        var barrier_body_material = new CANNON.Material();
        this.world.addContactMaterial(new CANNON.ContactMaterial(
                    desk_body_material, this.dice_body_material, 0.01, 0.5));
        this.world.addContactMaterial(new CANNON.ContactMaterial(
                    barrier_body_material, this.dice_body_material, 0, 1.0));
        this.world.addContactMaterial(new CANNON.ContactMaterial(
                    this.dice_body_material, this.dice_body_material, 0, 0.5));

        this.world.add(new CANNON.RigidBody(0, new CANNON.Plane(), desk_body_material));
        var barrier;
        barrier = new CANNON.RigidBody(0, new CANNON.Plane(), barrier_body_material);
        barrier.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
        barrier.position.set(0, this.h * 0.93, 0);
        this.world.add(barrier);

        barrier = new CANNON.RigidBody(0, new CANNON.Plane(), barrier_body_material);
        barrier.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        barrier.position.set(0, -this.h * 0.93, 0);
        this.world.add(barrier);

        barrier = new CANNON.RigidBody(0, new CANNON.Plane(), barrier_body_material);
        barrier.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI / 2);
        barrier.position.set(this.w * 0.93, 0, 0);
        this.world.add(barrier);

        barrier = new CANNON.RigidBody(0, new CANNON.Plane(), barrier_body_material);
        barrier.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
        barrier.position.set(-this.w * 0.93, 0, 0);
        this.world.add(barrier);

        this.last_time = 0;
        this.running = false;

        this.renderer.render(this.scene, this.camera);
    }

    // called on init and window resize
    that.dice_box.prototype.reinit = function(container) {
        this.cw = container.clientWidth / 2;
        this.ch = container.clientHeight / 2;
        this.w = this.cw;
        this.h = this.ch;
        this.aspect = Math.min(this.cw / this.w, this.ch / this.h);
        vars.scale = Math.sqrt(this.w * this.w + this.h * this.h) / 11; //RIFT: smaller dice
        //console.log('scale = ' + vars.scale);

        this.renderer.setSize(this.cw * 2, this.ch * 2);

        this.wh = this.ch / this.aspect / Math.tan(10 * Math.PI / 180);
        if (this.camera) this.scene.remove(this.camera);
        this.camera = new THREE.PerspectiveCamera(20, this.cw / this.ch, 1, this.wh * 1.3);
        this.camera.position.z = this.wh;

        var mw = Math.max(this.w, this.h);
        if (this.light) this.scene.remove(this.light);
        this.light = new THREE.SpotLight(vars.spot_light_color, 2.0);
        this.light.position.set(0, mw / 2, mw * 2);
        this.light.target.position.set(0, 0, 0);
        this.light.distance = mw * 5;
        this.light.castShadow = true;
        this.light.shadowCameraNear = mw / 10;
        this.light.shadowCameraFar = mw * 5;
        this.light.shadowCameraFov = 80;
        this.light.shadowBias = 0.0015;
        this.light.shadowDarkness = 1.1;
        this.light.shadowMapWidth = 4096;
        this.light.shadowMapHeight = 4096;
        this.scene.add(this.light);

        if (this.desk) this.scene.remove(this.desk);
        // RIFT: Low opacity desk for shadow rendering - nearly invisible on dark themes
        this.desk = new THREE.Mesh(new THREE.PlaneGeometry(this.w * 2, this.h * 2, 1, 1), 
                new THREE.MeshPhongMaterial({ color: '#000000', opacity: 0.25, transparent: true }));
        this.desk.receiveShadow = vars.use_shadows;
        this.scene.add(this.desk); 

        this.renderer.render(this.scene, this.camera);
    }

    // @param diceToRoll (string), ex: "1d100+1d10+1d4+1d6+1d8+1d12+1d20"
    that.dice_box.prototype.setDice = function(diceToRoll) {
        this.diceToRoll = diceToRoll;
    }
    
    // RIFT: Get screen positions of all dice for overlay labels
    that.dice_box.prototype.getDiceScreenPositions = function() {
        if (!this.dices || !this.camera || !this.container) return [];
        
        const positions = [];
        const containerRect = this.container.getBoundingClientRect();
        
        for (let i = 0; i < this.dices.length; i++) {
            const dice = this.dices[i];
            if (!dice || !dice.position) continue;
            
            // Create a vector from dice position
            const vector = new THREE.Vector3(
                dice.position.x,
                dice.position.y,
                dice.position.z + 30 // Offset upward (above the dice)
            );
            
            // Project to screen coordinates
            vector.project(this.camera);
            
            // Convert to pixel coordinates relative to container
            const x = (vector.x * 0.5 + 0.5) * containerRect.width;
            const y = (-vector.y * 0.5 + 0.5) * containerRect.height;
            
            positions.push({
                x: x,
                y: y,
                type: dice.dice_type
            });
        }
        
        return positions;
    }

    //call this to roll dice programatically or from click
    that.dice_box.prototype.start_throw = function(before_roll, after_roll) {
        var box = this;
        if (box.rolling) return;

        var vector = { x: (rnd() * 2 - 1) * box.w, y: -(rnd() * 2 - 1) * box.h };
        var dist = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
        var boost = (rnd() + 3) * dist;
        throw_dices(box, vector, boost, dist, before_roll, after_roll);
    }
    
    // RIFT: Throw with specific vector and boost
    that.dice_box.prototype.throw_with_vector = function(vector, boost, before_roll, after_roll) {
        var dist = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
        if (dist < 10) {
            // Fallback to random if vector too small
            this.start_throw(before_roll, after_roll);
            return;
        }
        throw_dices(this, vector, boost, dist, before_roll, after_roll);
    }

    //call this to roll dice from swipe (will throw dice in direction swiped)
    that.dice_box.prototype.bind_swipe = function(container, before_roll, after_roll) {
        let box = this;
        $t.bind(container, ['mousedown', 'touchstart'], function(ev) {
            ev.preventDefault();
            box.mouse_time = (new Date()).getTime();
            box.mouse_start = $t.get_mouse_coords(ev);
        });
        $t.bind(container, ['mouseup', 'touchend'], function(ev) {
            if (box.rolling) return; 
            if (box.mouse_start == undefined) return;
            var m = $t.get_mouse_coords(ev);
            var vector = { x: m.x - box.mouse_start.x, y: -(m.y - box.mouse_start.y) };
            box.mouse_start = undefined;
            var dist = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
            if (dist < Math.sqrt(box.w * box.h * 0.01)) return;
            var time_int = (new Date()).getTime() - box.mouse_time;
            if (time_int > 2000) time_int = 2000;
            var boost = Math.sqrt((2500 - time_int) / 2500) * dist * 2;           
            throw_dices(box, vector, boost, dist, before_roll, after_roll);
        });
    }

    function throw_dices(box, vector, boost, dist, before_roll, after_roll) {
        var uat = vars.use_adapvite_timestep;

        vector.x /= dist; vector.y /= dist;
        var notation = that.parse_notation(box.diceToRoll);
        if (notation.set.length == 0) return;
        //TODO: how do large numbers of vectors affect performance?
        var vectors = box.generate_vectors(notation, vector, boost);
        box.rolling = true;
        let request_results = null;        

        let numDice = vectors.length;
        numDice = numDice > 10 ? 10 : numDice;
        for(let i = 0; i < numDice; i++) {
            let volume = i/10;
            if(volume <= 0) volume = 0.1;
            if(volume > 1) volume = 1;
            playSound(box.container, volume);
            //todo: find a better way to do this
        }

        if (before_roll) {
            request_results = before_roll(notation);
        }
        roll(request_results);

        //@param request_results (optional) - pass in an array of desired roll results
        //todo: when this param is used, animation isn't as smooth (uat not used?)
        function roll(request_results) {
            box.clear();
            box.roll(vectors, request_results || notation.result, function(result) {
                notation.result = result;
                var res = result.join(' ');
                if (notation.constant) {
                    if (notation.constant > 0) res += ' +' + notation.constant;
                    else res += ' -' + Math.abs(notation.constant);
                }                
                notation.resultTotal = (result.reduce(function(s, a) { return s + a; }) + notation.constant);
                if (result.length > 1 || notation.constant) {
                    res += ' = ' + notation.resultTotal;
                }
                notation.resultString = res;

                if (after_roll) after_roll(notation);

                box.rolling = false;
                vars.use_adapvite_timestep = uat;
            });
        }
    }
       
    //todo: the rest of these don't need to be public, but need to read the this properties
    that.dice_box.prototype.generate_vectors = function(notation, vector, boost) {
        var vectors = [];
        for (var i in notation.set) {
            var vec = make_random_vector(vector);
            var pos = {
                x: this.w * (vec.x > 0 ? -1 : 1) * 0.9,
                y: this.h * (vec.y > 0 ? -1 : 1) * 0.9,
                z: rnd() * 200 + 200
            };
            var projector = Math.abs(vec.x / vec.y);
            if (projector > 1.0) pos.y /= projector; else pos.x *= projector;
            var velvec = make_random_vector(vector);
            var velocity = { x: velvec.x * boost, y: velvec.y * boost, z: -10 };
            var inertia = CONSTS.dice_inertia[notation.set[i]];
            var angle = {
                x: -(rnd() * vec.y * 5 + inertia * vec.y),
                y: rnd() * vec.x * 5 + inertia * vec.x,
                z: 0
            };
            var axis = { x: rnd(), y: rnd(), z: rnd(), a: rnd() };
            vectors.push({ set: notation.set[i], pos: pos, velocity: velocity, angle: angle, axis: axis });
        }
        return vectors;
    }

    that.dice_box.prototype.create_dice = function(type, pos, velocity, angle, axis) {
        console.log('[DICE] create_dice() for type:', type, 'vars.dice_texture:', vars.dice_texture);
        var dice = threeD_dice['create_' + type]();
        dice.castShadow = true;
        dice.dice_type = type;
        dice.body = new CANNON.RigidBody(CONSTS.dice_mass[type],
                dice.geometry.cannon_shape, this.dice_body_material);
        dice.body.position.set(pos.x, pos.y, pos.z);
        dice.body.quaternion.setFromAxisAngle(new CANNON.Vec3(axis.x, axis.y, axis.z), axis.a * Math.PI * 2);
        dice.body.angularVelocity.set(angle.x, angle.y, angle.z);
        dice.body.velocity.set(velocity.x, velocity.y, velocity.z);
        dice.body.linearDamping = 0.1;
        dice.body.angularDamping = 0.1;
        
        this.scene.add(dice);
        this.dices.push(dice);
        this.world.add(dice.body);
    }

    that.dice_box.prototype.check_if_throw_finished = function() {
        var res = true;
        var e = 6;
        if (this.iteration < 10 / vars.frame_rate) {
            for (var i = 0; i < this.dices.length; ++i) {
                var dice = this.dices[i];
                if (dice.dice_stopped === true) continue;
                var a = dice.body.angularVelocity, v = dice.body.velocity;
                if (Math.abs(a.x) < e && Math.abs(a.y) < e && Math.abs(a.z) < e &&
                        Math.abs(v.x) < e && Math.abs(v.y) < e && Math.abs(v.z) < e) {
                    if (dice.dice_stopped) {
                        if (this.iteration - dice.dice_stopped > 3) {
                            dice.dice_stopped = true;
                            continue;
                        }
                    }
                    else dice.dice_stopped = this.iteration;
                    res = false;
                }
                else {
                    dice.dice_stopped = undefined;
                    res = false;
                }
            }
        }
        return res;
    }

    that.dice_box.prototype.emulate_throw = function() {
        while (!this.check_if_throw_finished()) {
            ++this.iteration;
            this.world.step(vars.frame_rate);
        }
        return get_dice_values(this.dices);
    }

    that.dice_box.prototype.__animate = function(threadid) {
        var time = (new Date()).getTime();
        var time_diff = (time - this.last_time) / 1000;
        if (time_diff > 3) time_diff = vars.frame_rate;
        ++this.iteration;
        if (vars.use_adapvite_timestep) {
            while (time_diff > vars.frame_rate * 1.1) {
                this.world.step(vars.frame_rate);
                time_diff -= vars.frame_rate;
            }
            this.world.step(time_diff);
        }
        else {
            this.world.step(vars.frame_rate);
        }
        for (var i in this.scene.children) {
            var interact = this.scene.children[i];
            if (interact.body != undefined) {
                interact.position.copy(interact.body.position);
                interact.quaternion.copy(interact.body.quaternion);
            }
        }
        
        // RIFT: Glow/Pulse Effekte werden jetzt über CSS in dice.html gemacht
        
        this.renderer.render(this.scene, this.camera);
        this.last_time = this.last_time ? time : (new Date()).getTime();
        if (this.running == threadid && this.check_if_throw_finished()) {
            this.running = false;
            if (this.callback) this.callback.call(this, get_dice_values(this.dices));
            
            // RIFT: Glow/Pulse Effekte werden über CSS in dice.html gemacht
        }
        if (this.running == threadid) {
            (function(t, tid, uat) {
                if (!uat && time_diff < vars.frame_rate) {
                    setTimeout(function() { requestAnimationFrame(function() { t.__animate(tid); }); },
                        (vars.frame_rate - time_diff) * 1000);
                }
                else requestAnimationFrame(function() { t.__animate(tid); });
            })(this, threadid, vars.use_adapvite_timestep);
        }
    }
    
    // RIFT: Idle-Animation (jetzt über CSS in dice.html)
    that.dice_box.prototype.__startIdleAnimation = function() {
        // CSS-basierte Effekte brauchen keine JS-Animation
    }
    
    // RIFT: Idle-Animation stoppen
    that.dice_box.prototype.__stopIdleAnimation = function() {
        this.idleAnimating = false;
    }

    that.dice_box.prototype.clear = function() {
        this.running = false;
        this.__stopIdleAnimation(); // RIFT: Idle-Animation stoppen
        var dice;
        while (dice = this.dices.pop()) {
            this.scene.remove(dice); 
            if (dice.body) this.world.remove(dice.body);
        }
        if (this.pane) this.scene.remove(this.pane);
        this.renderer.render(this.scene, this.camera);
        var box = this;
        setTimeout(function() { box.renderer.render(box.scene, box.camera); }, 100);
    }

    that.dice_box.prototype.prepare_dices_for_roll = function(vectors) {
        this.clear();
        this.iteration = 0;
        for (var i in vectors) {
            this.create_dice(vectors[i].set, vectors[i].pos, vectors[i].velocity,
                    vectors[i].angle, vectors[i].axis);
        }
    }

    that.dice_box.prototype.roll = function(vectors, values, callback) {
        this.prepare_dices_for_roll(vectors);
        if (values != undefined && values.length) {
            vars.use_adapvite_timestep = false;
            var res = this.emulate_throw();
            this.prepare_dices_for_roll(vectors);
            for (var i in res)
                shift_dice_faces(this.dices[i], values[i], res[i]);
        }
        this.callback = callback;
        this.running = (new Date()).getTime();
        this.last_time = 0;
        this.__animate(this.running);
    }

    that.dice_box.prototype.search_dice_by_mouse = function(ev) {
        var m = $t.get_mouse_coords(ev);
        var intersects = (new THREE.Raycaster(this.camera.position, 
                    (new THREE.Vector3((m.x - this.cw) / this.aspect,
                                       1 - (m.y - this.ch) / this.aspect, this.w / 9))
                    .sub(this.camera.position).normalize())).intersectObjects(this.dices);
        if (intersects.length) return intersects[0].object.userData;
    }


    // PUBLIC FUNCTIONS

    //validates dice notation input
    //notation should be in format "1d4+2d6"
    that.parse_notation = function(notation) {
        var no = notation.split('@');
        var dr0 = /\s*(\d*)([a-z]+)(\d+)(\s*(\+|\-)\s*(\d+)){0,1}\s*(\+|$)/gi;
        var dr1 = /(\b)*(\d+)(\b)*/gi;
        var ret = { 
            set: [], //set of dice to roll
            constant: 0, //modifier to add to result
            result: [], //array of results of each die
            resultTotal: 0, //dice results + constant
            resultString: '', //printable result
            error: false //input errors are ignored gracefully
        }; 
        var res;
        //looks at each peice of the notation and adds dice and constants to results
        while (res = dr0.exec(no[0])) {
            var command = res[2];
            if (command != 'd') { ret.error = true; continue; }
            var count = parseInt(res[1]);
            if (res[1] == '') count = 1;
            var type = 'd' + res[3];
            if (CONSTS.known_types.indexOf(type) == -1) { ret.error = true; continue; }
            while (count--) ret.set.push(type);
            if (res[5] && res[6]) {
                if (res[5] == '+') ret.constant += parseInt(res[6]);
                else ret.constant -= parseInt(res[6]);
            }
        }
        while (res = dr1.exec(no[1])) {
            ret.result.push(parseInt(res[2]));
        }
        return ret;
    }

    that.stringify_notation = function(nn) {
        var dict = {}, notation = '';
        for (var i in nn.set) 
            if (!dict[nn.set[i]]) dict[nn.set[i]] = 1; else ++dict[nn.set[i]];
        for (var i in dict) {
            if (notation.length) notation += ' + ';
            notation += (dict[i] > 1 ? dict[i] : '') + i;
        }
        if (nn.constant) {
            if (nn.constant > 0) notation += ' + ' + nn.constant;
            else notation += ' - ' + Math.abs(nn.constant);
        }
        return notation;
    }
    
    // PRIVATE FUNCTIONS

    // dice geometries
    let threeD_dice = {};

    threeD_dice.create_d4 = function() {
        if (!this.d4_geometry) this.d4_geometry = create_d4_geometry(vars.scale * 1.2);
        if (!this.d4_material) this.d4_material = new THREE.MeshFaceMaterial(
                create_d4_materials(vars.scale / 2, vars.scale * 2, CONSTS.d4_labels[0]));
        return new THREE.Mesh(this.d4_geometry, this.d4_material);
    }

    threeD_dice.create_d6 = function() {
        if (!this.d6_geometry) this.d6_geometry = create_d6_geometry(vars.scale * 1.1);
        if (!this.d6_material) this.d6_material = new THREE.MeshFaceMaterial(
                create_dice_materials(CONSTS.standart_d20_dice_face_labels, vars.scale / 2, 0.9));
        return new THREE.Mesh(this.d6_geometry, this.d6_material);
    }

    threeD_dice.create_d8 = function() {
        if (!this.d8_geometry) this.d8_geometry = create_d8_geometry(vars.scale);
        if (!this.d8_material) this.d8_material = new THREE.MeshFaceMaterial(
                create_dice_materials(CONSTS.standart_d20_dice_face_labels, vars.scale / 2, 1.4));
        return new THREE.Mesh(this.d8_geometry, this.d8_material);
    }

    // D10-based dice: Kite-Quad-Geometrie → Gradient/Textur nahtlos pro Fläche
    threeD_dice.create_d9 = function() {
        if (!this.d10_geometry) this.d10_geometry = create_d10_geometry(vars.scale * 0.9);
        if (!this.d10_material) this.d10_material = new THREE.MeshFaceMaterial(
                create_dice_materials(CONSTS.standart_d20_dice_face_labels, vars.scale / 2, 1.0));
        return new THREE.Mesh(this.d10_geometry, this.d10_material);
    }

    threeD_dice.create_d10 = function() {
        if (!this.d10_geometry) this.d10_geometry = create_d10_geometry(vars.scale * 0.9);
        if (!this.d10_material) this.d10_material = new THREE.MeshFaceMaterial(
                create_dice_materials(CONSTS.standart_d20_dice_face_labels, vars.scale / 2, 1.0));
        return new THREE.Mesh(this.d10_geometry, this.d10_material);
    }

    threeD_dice.create_d12 = function() {
        if (!this.d12_geometry) this.d12_geometry = create_d12_geometry(vars.scale * 0.9);
        if (!this.d12_material) this.d12_material = new THREE.MeshFaceMaterial(
                create_dice_materials(CONSTS.standart_d20_dice_face_labels, vars.scale / 2, 1.0));
        return new THREE.Mesh(this.d12_geometry, this.d12_material);
    }

    threeD_dice.create_d20 = function() {
        if (!this.d20_geometry) this.d20_geometry = create_d20_geometry(vars.scale);
        if (!this.d20_material) this.d20_material = new THREE.MeshFaceMaterial(
                create_dice_materials(CONSTS.standart_d20_dice_face_labels, vars.scale / 2, 1.0));
        return new THREE.Mesh(this.d20_geometry, this.d20_material);
    }

    threeD_dice.create_d100 = function() {
        if (!this.d10_geometry) this.d10_geometry = create_d10_geometry(vars.scale * 0.9);
        if (!this.d100_material) this.d100_material = new THREE.MeshFaceMaterial(
                create_dice_materials(CONSTS.standart_d100_dice_face_labels, vars.scale / 2, 1.5));
        return new THREE.Mesh(this.d10_geometry, this.d100_material);
    }

    // RIFT: Flag ob Label-Farbe manuell gesetzt wurde
    var manualLabelColor = null;
    var labelTextStyle = false; // true wenn text style von setLabelColor gesetzt wurde
    
    // RIFT: Methode um Würfelfarbe zu ändern
    that.setDiceColor = function(color, gradient, texture, materialOverride, textStyle, neonColor) {
        vars.dice_color = color;
        vars.dice_gradient = gradient || null;
        vars.dice_texture = texture || null;
        vars.dice_material_override = materialOverride || null;
        // Nur text style überschreiben wenn explizit vom Theme gesetzt, NICHT wenn von Label gesetzt
        if (textStyle) {
            vars.dice_text_style = textStyle;
            vars.dice_neon_color = neonColor || null;
            labelTextStyle = false;
        } else if (!labelTextStyle) {
            vars.dice_text_style = null;
            vars.dice_neon_color = null;
        }
        
        // RIFT: Nur automatisch Label-Farbe wählen wenn KEINE manuelle Farbe gesetzt ist
        if (!manualLabelColor) {
            var baseColor = texture ? texture.baseColor : (gradient ? gradient.colors[0] : color);
            var brightness = getColorBrightness(baseColor || color);
            vars.label_color = brightness > 160 ? vars.label_color_dark : '#ffffff';
        }
        
        // Cache löschen damit neue Materialien erstellt werden
        threeD_dice.d4_material = null;
        threeD_dice.dice_material = null;
        threeD_dice.d100_material = null;
        threeD_dice.d6_material = null;
        threeD_dice.d8_material = null;
        threeD_dice.d10_material = null;
        threeD_dice.d12_material = null;
        threeD_dice.d20_material = null;
    };
    
    // RIFT: Methode um Zahlenfarbe manuell zu setzen
    that.setLabelColor = function(color) {
        if (color === 'auto' || color === null) {
            // Zurück zu automatischer Berechnung
            manualLabelColor = null;
            labelTextStyle = false;
            vars.dice_text_style = null;
            vars.dice_neon_color = null;
            vars.dice_text_color2 = null;
            var brightness = getColorBrightness(vars.dice_gradient ? vars.dice_gradient.colors[0] : vars.dice_color);
            vars.label_color = brightness > 160 ? vars.label_color_dark : '#ffffff';
        } else if (typeof color === 'string' && color.indexOf('style:') === 0) {
            // Style-encoded label: style:{type}:{color1}:{color2}
            var parts = color.split(':');
            var styleName = parts[1] || 'neon';
            var color1 = parts[2] || '#ffffff';
            var color2 = parts[3] || null;
            manualLabelColor = color;
            labelTextStyle = true;
            vars.label_color = color1;
            vars.dice_text_style = styleName;
            vars.dice_text_color2 = color2;
            if (styleName === 'neon') {
                vars.dice_neon_color = color1;
            }
        } else {
            // Einfache manuelle Farbe - Style zurücksetzen
            manualLabelColor = color;
            labelTextStyle = false;
            vars.label_color = color;
            vars.dice_text_style = null;
            vars.dice_neon_color = null;
            vars.dice_text_color2 = null;
        }
        
        // Cache löschen damit neue Materialien erstellt werden
        clearMaterialCache();
    };
    
    // RIFT: Helper um Material Cache zu löschen (muss vor setLabelColor definiert sein)
    function clearMaterialCache() {
        threeD_dice.d4_material = null;
        threeD_dice.dice_material = null;
        threeD_dice.d100_material = null;
        threeD_dice.d6_material = null;
        threeD_dice.d8_material = null;
        threeD_dice.d10_material = null;
        threeD_dice.d12_material = null;
        threeD_dice.d20_material = null;
    }
    
    // RIFT: Getter für aktuelle Label-Farbe
    that.getLabelColor = function() {
        return manualLabelColor || vars.label_color;
    };
    
    // RIFT: Prüfen ob Label-Farbe manuell ist
    that.isLabelColorManual = function() {
        return manualLabelColor !== null;
    };
    
    // RIFT: Glow Effect setzen
    that.setGlow = function(enabled, color, intensity) {
        vars.dice_glow = enabled;
        if (color !== undefined) vars.dice_glow_color = color;
        if (intensity !== undefined) vars.dice_glow_intensity = intensity;
        
        // Material Cache löschen
        clearMaterialCache();
    };
    
    // RIFT: Pulse Effect setzen
    that.setPulse = function(enabled, speed, min, max) {
        vars.dice_pulse = enabled;
        if (speed !== undefined) vars.dice_pulse_speed = speed;
        if (min !== undefined) vars.dice_pulse_min = min;
        if (max !== undefined) vars.dice_pulse_max = max;
        
        // Glow muss an sein für Pulse
        if (enabled && !vars.dice_glow) {
            vars.dice_glow = true;
        }
        
        // Material Cache löschen
        clearMaterialCache();
    };
    
    // RIFT: Getter für Effekt-Status
    that.getEffects = function() {
        return {
            glow: vars.dice_glow,
            glowColor: vars.dice_glow_color,
            glowIntensity: vars.dice_glow_intensity,
            glowDistance: vars.dice_glow_distance,
            pulse: vars.dice_pulse,
            pulseSpeed: vars.dice_pulse_speed,
            pulseMin: vars.dice_pulse_min,
            pulseMax: vars.dice_pulse_max
        };
    };
    
    // RIFT: Berechne Helligkeit einer Farbe (0-255)
    function getColorBrightness(hexColor) {
        if (!hexColor) return 0;
        var hex = hexColor.replace('#', '');
        var r = parseInt(hex.substr(0, 2), 16);
        var g = parseInt(hex.substr(2, 2), 16);
        var b = parseInt(hex.substr(4, 2), 16);
        return (r * 299 + g * 587 + b * 114) / 1000;
    }
    
    // RIFT: Skaliere und helle Farbe auf für Glow-Effekt
    function scaleColorByIntensity(hexColor, intensity) {
        if (!hexColor) return 0x444444;
        var hex = (typeof hexColor === 'string') ? hexColor.replace('#', '') : hexColor.toString(16).padStart(6, '0');
        var r = parseInt(hex.substr(0, 2), 16);
        var g = parseInt(hex.substr(2, 2), 16);
        var b = parseInt(hex.substr(4, 2), 16);
        
        // Mit Intensity skalieren
        r = Math.min(255, Math.floor(r * intensity));
        g = Math.min(255, Math.floor(g * intensity));
        b = Math.min(255, Math.floor(b * intensity));
        
        return (r << 16) | (g << 8) | b;
    }
    
    // RIFT: Farbe aufhellen (amount 0-1, wobei 1 = weiß)
    function lightenColor(hexColor, amount) {
        if (!hexColor) return '#ffffff';
        var hex = hexColor.replace('#', '');
        var r = parseInt(hex.substr(0, 2), 16);
        var g = parseInt(hex.substr(2, 2), 16);
        var b = parseInt(hex.substr(4, 2), 16);
        
        // Aufhellen: Richtung Weiß verschieben
        r = Math.floor(r + (255 - r) * amount);
        g = Math.floor(g + (255 - g) * amount);
        b = Math.floor(b + (255 - b) * amount);
        
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
    
    // RIFT: Speichere Basis-Glow-Farbe für Pulse
    var baseGlowColor = null;
    
    // RIFT: Texture generation functions
    function generateMarbleTexture(ctx, width, height, baseColor, veinColor) {
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);
        
        // Primary veins - thick, prominent
        ctx.strokeStyle = veinColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.45;
        
        for (var i = 0; i < 12; i++) {
            ctx.beginPath();
            var x = Math.random() * width;
            var y = Math.random() * height;
            ctx.moveTo(x, y);
            ctx.lineWidth = 1 + Math.random() * 2.5;
            
            for (var j = 0; j < 6; j++) {
                var cp1x = x + (Math.random() - 0.5) * width * 0.5;
                var cp1y = y + (Math.random() - 0.5) * height * 0.5;
                var cp2x = x + (Math.random() - 0.5) * width * 0.5;
                var cp2y = y + (Math.random() - 0.5) * height * 0.5;
                x = Math.random() * width;
                y = Math.random() * height;
                ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
            }
            ctx.stroke();
        }
        
        // Secondary fine veins
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = 0.5;
        for (var i = 0; i < 8; i++) {
            ctx.beginPath();
            var x = Math.random() * width, y = Math.random() * height;
            ctx.moveTo(x, y);
            for (var j = 0; j < 4; j++) {
                x += (Math.random() - 0.5) * width * 0.4;
                y += (Math.random() - 0.5) * height * 0.4;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        
        // Noise/speckles
        ctx.globalAlpha = 0.15;
        for (var i = 0; i < 150; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? veinColor : baseColor;
            ctx.beginPath();
            ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.globalAlpha = 1.0;
    }
    
    function generateCrystalTexture(ctx, width, height, baseColor, veinColor) {
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);
        
        // Crystal veins - elegant, fewer than marble
        ctx.strokeStyle = veinColor;
        ctx.globalAlpha = 0.5;
        
        for (var i = 0; i < 6; i++) {
            ctx.beginPath();
            var x = Math.random() * width;
            var y = Math.random() * height;
            ctx.moveTo(x, y);
            ctx.lineWidth = 0.5 + Math.random() * 1.5;
            
            for (var j = 0; j < 4; j++) {
                var cp1x = x + (Math.random() - 0.5) * width * 0.4;
                var cp1y = y + (Math.random() - 0.5) * height * 0.4;
                var cp2x = x + (Math.random() - 0.5) * width * 0.4;
                var cp2y = y + (Math.random() - 0.5) * height * 0.4;
                x = Math.random() * width;
                y = Math.random() * height;
                ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
            }
            ctx.stroke();
        }
        
        // Fine secondary veins
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = 0.3;
        for (var i = 0; i < 5; i++) {
            ctx.beginPath();
            var x = Math.random() * width, y = Math.random() * height;
            ctx.moveTo(x, y);
            for (var j = 0; j < 3; j++) {
                x += (Math.random() - 0.5) * width * 0.3;
                y += (Math.random() - 0.5) * height * 0.3;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        
        // NO speckles/bubbles - clean crystal look
        ctx.globalAlpha = 1.0;
    }
    
    // Cached grain overlay - generated once, reused for all gem faces
    var _grainCache = {};
    function getGrainOverlay(size) {
        if (_grainCache[size]) return _grainCache[size];
        var c = document.createElement('canvas');
        c.width = c.height = size;
        var ctx = c.getContext('2d');
        var imageData = ctx.createImageData(size, size);
        var pixels = imageData.data;
        for (var i = 0; i < pixels.length; i += 4) {
            var v = Math.random() * 255;
            pixels[i] = pixels[i + 1] = pixels[i + 2] = v;
            pixels[i + 3] = 60; // ~0.24 alpha for subtle grain
        }
        ctx.putImageData(imageData, 0, 0);
        _grainCache[size] = c;
        return c;
    }
    
    function generateGemTexture(ctx, width, height, baseColor, veinColor) {
        var cx = width * 0.5, cy = height * 0.5;
        
        // --- 1. Base + Sättigungs-Zonen (color variation patches) ---
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);
        
        // Parse baseColor for HSL shifting
        ctx.save();
        for (var i = 0; i < 3; i++) {
            var zx = Math.random() * width;
            var zy = Math.random() * height;
            var zr = width * (0.2 + Math.random() * 0.25);
            var zGrd = ctx.createRadialGradient(zx, zy, 0, zx, zy, zr);
            // Alternate lighter and slightly different-hued patches
            if (i % 2 === 0) {
                zGrd.addColorStop(0, 'rgba(255,255,255,0.06)');
                zGrd.addColorStop(1, 'rgba(255,255,255,0)');
            } else {
                zGrd.addColorStop(0, veinColor);
                zGrd.addColorStop(1, baseColor);
            }
            ctx.globalAlpha = i % 2 === 0 ? 0.5 : 0.08;
            ctx.fillStyle = zGrd;
            ctx.fillRect(0, 0, width, height);
        }
        ctx.restore();
        
        // --- 2. Farb-Tiefe Vignette (darker at edges) ---
        ctx.globalAlpha = 1.0;
        var vig = ctx.createRadialGradient(cx, cy, width * 0.1, cx, cy, width * 0.6);
        vig.addColorStop(0, 'rgba(255,255,255,0.04)');
        vig.addColorStop(0.4, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.15)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, width, height);
        
        // --- 3. Facetten-Schliff Lichtbrechung (crossing light lines) ---
        ctx.save();
        ctx.globalAlpha = 0.07;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.8;
        
        // Star-like refraction pattern from center
        var numRays = 5 + Math.floor(Math.random() * 3);
        var angleOff = Math.random() * Math.PI;
        for (var i = 0; i < numRays; i++) {
            var angle = angleOff + (i / numRays) * Math.PI;
            ctx.beginPath();
            ctx.moveTo(
                cx + Math.cos(angle) * width * 0.05,
                cy + Math.sin(angle) * height * 0.05
            );
            ctx.lineTo(
                cx + Math.cos(angle) * width * 0.55,
                cy + Math.sin(angle) * height * 0.55
            );
            ctx.stroke();
        }
        
        // A couple of faint triangular brilliance shapes
        ctx.globalAlpha = 0.04;
        ctx.fillStyle = '#ffffff';
        for (var i = 0; i < 2; i++) {
            var tx = cx + (Math.random() - 0.5) * width * 0.3;
            var ty = cy + (Math.random() - 0.5) * height * 0.3;
            var ts = width * (0.06 + Math.random() * 0.08);
            var ta = Math.random() * Math.PI * 2;
            ctx.beginPath();
            for (var j = 0; j < 3; j++) {
                var px = tx + Math.cos(ta + j * Math.PI * 2 / 3) * ts;
                var py = ty + Math.sin(ta + j * Math.PI * 2 / 3) * ts;
                j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
        
        // --- 4. Schliff-Kanten (sub-facet geometric lines) ---
        ctx.save();
        ctx.globalAlpha = 0.05;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.4;
        
        // Lines from corners/edges through center area
        var corners = [
            [0, 0], [width, 0], [width, height], [0, height],
            [width * 0.5, 0], [width, height * 0.5], [width * 0.5, height], [0, height * 0.5]
        ];
        for (var i = 0; i < 4; i++) {
            var c1 = corners[Math.floor(Math.random() * corners.length)];
            var target = [
                cx + (Math.random() - 0.5) * width * 0.3,
                cy + (Math.random() - 0.5) * height * 0.3
            ];
            ctx.beginPath();
            ctx.moveTo(c1[0], c1[1]);
            ctx.lineTo(target[0], target[1]);
            ctx.stroke();
        }
        ctx.restore();
        
        // --- 5. Subtle veins (very faint internal structure) ---
        ctx.strokeStyle = veinColor;
        ctx.globalAlpha = 0.25;
        for (var i = 0; i < 3; i++) {
            ctx.beginPath();
            var x = Math.random() * width;
            var y = Math.random() * height;
            ctx.moveTo(x, y);
            ctx.lineWidth = 0.2 + Math.random() * 0.5;
            for (var j = 0; j < 3; j++) {
                var cp1x = x + (Math.random() - 0.5) * width * 0.3;
                var cp1y = y + (Math.random() - 0.5) * height * 0.3;
                var cp2x = x + (Math.random() - 0.5) * width * 0.3;
                var cp2y = y + (Math.random() - 0.5) * height * 0.3;
                x = Math.random() * width;
                y = Math.random() * height;
                ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
            }
            ctx.stroke();
        }
        
        // --- 6. Cached grain overlay ---
        ctx.globalAlpha = 0.35;
        ctx.drawImage(getGrainOverlay(width), 0, 0);
        ctx.globalAlpha = 1.0;
    }
    
    function generateLavaTexture(ctx, width, height, baseColor, glowColor) {
        // Dark base with glowing cracks
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);
        
        // Subtle dark variation
        ctx.globalAlpha = 0.15;
        for (var i = 0; i < 8; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#000000' : '#1a1a1a';
            ctx.beginPath();
            var rx = Math.random() * width, ry = Math.random() * height;
            var rr = width * (0.05 + Math.random() * 0.15);
            ctx.arc(rx, ry, rr, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Glowing cracks - main
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = glowColor;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 6;
        ctx.lineWidth = 1.2;
        
        for (var i = 0; i < 5; i++) {
            ctx.beginPath();
            var x = Math.random() * width, y = Math.random() * height;
            ctx.moveTo(x, y);
            for (var j = 0; j < 5; j++) {
                // Jagged crack lines
                x += (Math.random() - 0.5) * width * 0.3;
                y += (Math.random() - 0.5) * height * 0.3;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        
        // Thinner branching cracks
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 0.5;
        ctx.shadowBlur = 3;
        for (var i = 0; i < 8; i++) {
            ctx.beginPath();
            var x = Math.random() * width, y = Math.random() * height;
            ctx.moveTo(x, y);
            for (var j = 0; j < 3; j++) {
                x += (Math.random() - 0.5) * width * 0.2;
                y += (Math.random() - 0.5) * height * 0.2;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        
        // Hot spots at crack intersections
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 0.3;
        for (var i = 0; i < 3; i++) {
            var hx = Math.random() * width, hy = Math.random() * height;
            var hGrd = ctx.createRadialGradient(hx, hy, 0, hx, hy, width * 0.08);
            hGrd.addColorStop(0, glowColor);
            hGrd.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = hGrd;
            ctx.fillRect(0, 0, width, height);
        }
        
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
    }
    
    function generatePearlescentTexture(ctx, width, height, baseColor, shimmerColor) {
        // Soft iridescent base
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);
        
        // Iridescent color zones - overlapping gradients with different hues
        var hues = [shimmerColor, '#ffccee', '#ccffee', '#eeccff', '#ffffcc'];
        for (var i = 0; i < 4; i++) {
            var zx = Math.random() * width;
            var zy = Math.random() * height;
            var zr = width * (0.25 + Math.random() * 0.3);
            var zGrd = ctx.createRadialGradient(zx, zy, 0, zx, zy, zr);
            zGrd.addColorStop(0, hues[i % hues.length]);
            zGrd.addColorStop(1, baseColor);
            ctx.globalAlpha = 0.08;
            ctx.fillStyle = zGrd;
            ctx.fillRect(0, 0, width, height);
        }
        
        // Sweeping shimmer bands (like oil on water)
        ctx.globalAlpha = 0.06;
        for (var i = 0; i < 6; i++) {
            var angle = Math.random() * Math.PI;
            var bx = width * 0.5 + Math.cos(angle) * width * 0.3;
            var by = height * 0.5 + Math.sin(angle) * height * 0.3;
            var bGrd = ctx.createLinearGradient(
                bx - Math.cos(angle + Math.PI/2) * width * 0.4,
                by - Math.sin(angle + Math.PI/2) * height * 0.4,
                bx + Math.cos(angle + Math.PI/2) * width * 0.4,
                by + Math.sin(angle + Math.PI/2) * height * 0.4
            );
            bGrd.addColorStop(0, 'rgba(255,255,255,0)');
            bGrd.addColorStop(0.4, shimmerColor);
            bGrd.addColorStop(0.6, 'rgba(255,255,255,0.5)');
            bGrd.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = bGrd;
            ctx.fillRect(0, 0, width, height);
        }
        
        // Soft center highlight
        var cGrd = ctx.createRadialGradient(width * 0.45, height * 0.4, 0, width * 0.5, height * 0.5, width * 0.5);
        cGrd.addColorStop(0, 'rgba(255,255,255,0.1)');
        cGrd.addColorStop(0.5, 'rgba(255,255,255,0.02)');
        cGrd.addColorStop(1, 'rgba(0,0,0,0.04)');
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = cGrd;
        ctx.fillRect(0, 0, width, height);
        
        ctx.globalAlpha = 1.0;
    }
    
    function generateToxicTexture(ctx, width, height, baseColor, neonColor) {
        // Dark base
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);
        
        // Toxic swirl patterns
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = neonColor;
        ctx.lineWidth = 3;
        for (var i = 0; i < 4; i++) {
            ctx.beginPath();
            var x = Math.random() * width, y = Math.random() * height;
            ctx.moveTo(x, y);
            for (var j = 0; j < 6; j++) {
                var cp1x = x + (Math.random() - 0.5) * width * 0.6;
                var cp1y = y + (Math.random() - 0.5) * height * 0.6;
                x = Math.random() * width;
                y = Math.random() * height;
                ctx.quadraticCurveTo(cp1x, cp1y, x, y);
            }
            ctx.stroke();
        }
        
        // Neon glow patches
        ctx.globalAlpha = 0.08;
        for (var i = 0; i < 5; i++) {
            var gx = Math.random() * width, gy = Math.random() * height;
            var gr = width * (0.08 + Math.random() * 0.12);
            var gGrd = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
            gGrd.addColorStop(0, neonColor);
            gGrd.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gGrd;
            ctx.fillRect(0, 0, width, height);
        }
        
        // Fine veiny network (like toxic veins)
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = neonColor;
        ctx.lineWidth = 0.4;
        for (var i = 0; i < 10; i++) {
            ctx.beginPath();
            var x = Math.random() * width, y = Math.random() * height;
            ctx.moveTo(x, y);
            for (var j = 0; j < 4; j++) {
                x += (Math.random() - 0.5) * width * 0.25;
                y += (Math.random() - 0.5) * height * 0.25;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        
        // Cached grain
        ctx.globalAlpha = 0.2;
        ctx.drawImage(getGrainOverlay(width), 0, 0);
        ctx.globalAlpha = 1.0;
    }
    
    function generatePatinaTexture(ctx, width, height, baseColor, patinaColor) {
        // Metal base
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);
        
        // Fine grain for metal surface
        ctx.globalAlpha = 0.3;
        ctx.drawImage(getGrainOverlay(width), 0, 0);
        
        // Patina/oxidation patches - irregular blobs
        ctx.globalAlpha = 1.0;
        for (var i = 0; i < 6; i++) {
            var px = Math.random() * width, py = Math.random() * height;
            var pr = width * (0.1 + Math.random() * 0.2);
            var pGrd = ctx.createRadialGradient(px, py, 0, px, py, pr);
            pGrd.addColorStop(0, patinaColor);
            pGrd.addColorStop(0.6, patinaColor);
            pGrd.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = 0.15 + Math.random() * 0.1;
            ctx.fillStyle = pGrd;
            ctx.fillRect(0, 0, width, height);
        }
        
        // Scratches and wear marks
        ctx.globalAlpha = 0.08;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.3;
        for (var i = 0; i < 12; i++) {
            ctx.beginPath();
            var sx = Math.random() * width, sy = Math.random() * height;
            var angle = Math.random() * Math.PI;
            var len = width * (0.05 + Math.random() * 0.15);
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
            ctx.stroke();
        }
        
        // Edge darkening / weathering
        var eGrd = ctx.createRadialGradient(width * 0.5, height * 0.5, width * 0.15, width * 0.5, height * 0.5, width * 0.55);
        eGrd.addColorStop(0, 'rgba(0,0,0,0)');
        eGrd.addColorStop(1, 'rgba(0,0,0,0.12)');
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = eGrd;
        ctx.fillRect(0, 0, width, height);
        
        ctx.globalAlpha = 1.0;
    }
    
    function generateCelestialTexture(ctx, width, height, baseColor, highlightColor) {
        // Base surface
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);
        
        // Crater impacts
        for (var i = 0; i < 5; i++) {
            var cx = Math.random() * width, cy = Math.random() * height;
            var cr = width * (0.03 + Math.random() * 0.07);
            
            // Crater ring (raised rim)
            ctx.globalAlpha = 0.1;
            ctx.strokeStyle = highlightColor;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.arc(cx, cy, cr, 0, Math.PI * 2);
            ctx.stroke();
            
            // Crater shadow (inner)
            var cGrd = ctx.createRadialGradient(cx - cr * 0.2, cy - cr * 0.2, 0, cx, cy, cr);
            cGrd.addColorStop(0, 'rgba(0,0,0,0.12)');
            cGrd.addColorStop(0.7, 'rgba(0,0,0,0.04)');
            cGrd.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = 1.0;
            ctx.fillStyle = cGrd;
            ctx.fillRect(0, 0, width, height);
        }
        
        // Surface dust / regolith variation
        ctx.globalAlpha = 0.25;
        ctx.drawImage(getGrainOverlay(width), 0, 0);
        
        // Soft glow from above
        var sGrd = ctx.createRadialGradient(width * 0.35, height * 0.3, 0, width * 0.5, height * 0.5, width * 0.6);
        sGrd.addColorStop(0, 'rgba(255,255,255,0.06)');
        sGrd.addColorStop(0.5, 'rgba(255,255,255,0)');
        sGrd.addColorStop(1, 'rgba(0,0,0,0.06)');
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = sGrd;
        ctx.fillRect(0, 0, width, height);
        
        // Tiny surface pebbles/rocks
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = highlightColor;
        for (var i = 0; i < 15; i++) {
            var px = Math.random() * width, py = Math.random() * height;
            var ps = 0.5 + Math.random() * 1.5;
            ctx.beginPath();
            ctx.arc(px, py, ps, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.globalAlpha = 1.0;
    }
    
    function generateWoodTexture(ctx, width, height, baseColor, grainColor) {
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);
        
        // Wood grain lines - stronger
        ctx.strokeStyle = grainColor;
        ctx.globalAlpha = 0.3;
        
        for (var i = 0; i < 28; i++) {
            ctx.lineWidth = 1 + Math.random() * 3;
            ctx.beginPath();
            var y = (i / 28) * height + (Math.random() - 0.5) * 10;
            ctx.moveTo(0, y);
            
            for (var x = 0; x < width; x += 8) {
                y += (Math.random() - 0.5) * 5;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        
        // Wood knots (1-2 per face)
        ctx.globalAlpha = 0.18;
        for (var i = 0; i < 2; i++) {
            var kx = width * 0.2 + Math.random() * width * 0.6;
            var ky = height * 0.2 + Math.random() * height * 0.6;
            for (var r = 3; r > 0; r--) {
                ctx.beginPath();
                ctx.ellipse(kx, ky, 4 + r * 4, 2 + r * 2, Math.random() * 0.5, 0, Math.PI * 2);
                ctx.strokeStyle = grainColor;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
        
        ctx.globalAlpha = 1.0;
    }
    
    function generateStoneTexture(ctx, width, height, baseColor, speckleColor) {
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);
        
        // Speckles - more and bolder
        for (var i = 0; i < 300; i++) {
            ctx.globalAlpha = 0.15 + Math.random() * 0.28;
            ctx.fillStyle = Math.random() > 0.5 ? speckleColor : baseColor;
            var size = 1 + Math.random() * 5;
            ctx.beginPath();
            ctx.arc(Math.random() * width, Math.random() * height, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Subtle cracks
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = speckleColor;
        ctx.lineWidth = 0.8;
        for (var i = 0; i < 5; i++) {
            ctx.beginPath();
            var x = Math.random() * width, y = Math.random() * height;
            ctx.moveTo(x, y);
            for (var j = 0; j < 4; j++) {
                x += (Math.random() - 0.5) * width * 0.3;
                y += (Math.random() - 0.5) * height * 0.3;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        
        ctx.globalAlpha = 1.0;
    }
    
    function generateLeatherTexture(ctx, width, height, baseColor, grainColor) {
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);
        
        // Leather grain: bold irregular bumps
        ctx.globalAlpha = 0.18;
        for (var i = 0; i < 400; i++) {
            ctx.fillStyle = Math.random() > 0.35 ? grainColor : baseColor;
            var x = Math.random() * width;
            var y = Math.random() * height;
            var w = 2 + Math.random() * 7;
            var h = 2 + Math.random() * 5;
            ctx.beginPath();
            ctx.ellipse(x, y, w, h, Math.random() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Crease lines - stronger
        ctx.strokeStyle = grainColor;
        ctx.globalAlpha = 0.14;
        ctx.lineWidth = 0.8;
        for (var i = 0; i < 16; i++) {
            ctx.beginPath();
            var x = Math.random() * width;
            var y = Math.random() * height;
            ctx.moveTo(x, y);
            for (var j = 0; j < 4; j++) {
                x += (Math.random() - 0.5) * width * 0.35;
                y += (Math.random() - 0.5) * height * 0.35;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        
        ctx.globalAlpha = 1.0;
    }
    
    function generateMetalBrushedTexture(ctx, width, height, baseColor, brushColor) {
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);
        
        // Brushed metal: dense horizontal lines
        ctx.globalAlpha = 0.1;
        for (var i = 0; i < 120; i++) {
            ctx.strokeStyle = Math.random() > 0.5 ? brushColor : baseColor;
            ctx.lineWidth = 0.5 + Math.random() * 1.5;
            ctx.beginPath();
            var y = (i / 120) * height + (Math.random() - 0.5) * 6;
            ctx.moveTo(0, y);
            for (var x = 0; x < width; x += 5) {
                y += (Math.random() - 0.5) * 1.5;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        
        // Strong highlight streak
        var grad = ctx.createLinearGradient(0, 0, width, height * 0.3);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.35, 'rgba(255,255,255,0.1)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
        grad.addColorStop(0.65, 'rgba(255,255,255,0.1)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        
        ctx.globalAlpha = 1.0;
    }
    
    // RIFT PRO: Galaxy/Nebula Texture
    function generateGalaxyTexture(ctx, width, height, baseColor, nebulaColor1, nebulaColor2) {
        // Dunkler Weltraum-Hintergrund
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);
        
        // Nebula-Wolken: Mehrere überlagerte Radial-Gradienten
        var blobs = [
            { x: 0.3, y: 0.4, r: 0.5, color: nebulaColor1, alpha: 0.35 },
            { x: 0.7, y: 0.6, r: 0.4, color: nebulaColor2, alpha: 0.3 },
            { x: 0.5, y: 0.3, r: 0.35, color: nebulaColor1, alpha: 0.2 },
            { x: 0.2, y: 0.7, r: 0.3, color: nebulaColor2, alpha: 0.25 }
        ];
        
        for (var i = 0; i < blobs.length; i++) {
            var b = blobs[i];
            var cx = b.x * width + (Math.random() - 0.5) * width * 0.15;
            var cy = b.y * height + (Math.random() - 0.5) * height * 0.15;
            var rad = b.r * Math.min(width, height);
            
            var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
            grad.addColorStop(0, b.color);
            grad.addColorStop(0.4, b.color);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            
            ctx.globalAlpha = b.alpha;
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);
        }
        
        // Sterne: Viele kleine weiße Punkte
        ctx.globalAlpha = 1.0;
        for (var i = 0; i < 60; i++) {
            var brightness = 0.3 + Math.random() * 0.7;
            var size = 0.5 + Math.random() * 1.5;
            ctx.globalAlpha = brightness;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(Math.random() * width, Math.random() * height, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Ein paar hellere Sterne mit Glow
        for (var i = 0; i < 5; i++) {
            var sx = Math.random() * width;
            var sy = Math.random() * height;
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(sx, sy, 4 + Math.random() * 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.arc(sx, sy, 1, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.globalAlpha = 1.0;
    }
    
    // RIFT PRO: Lava-Cracks Texture
    function generateLavaCracksTexture(ctx, width, height, baseColor, crackColor, glowColor) {
        // Dunkle Basis
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);
        
        // Subtile Stein-Textur im Hintergrund
        ctx.globalAlpha = 0.08;
        for (var i = 0; i < 80; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#333' : '#111';
            ctx.beginPath();
            ctx.arc(Math.random() * width, Math.random() * height, 2 + Math.random() * 5, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Lava-Risse zeichnen: Verzweigende leuchtende Linien
        function drawCrack(startX, startY, angle, length, thickness, depth) {
            if (depth <= 0 || length < 5) return;
            
            var x = startX;
            var y = startY;
            var segments = Math.floor(length / 8);
            
            // Glow Layer (breiterer, transparenterer Strich)
            ctx.globalAlpha = 0.3;
            ctx.strokeStyle = glowColor || crackColor;
            ctx.lineWidth = thickness * 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x, y);
            
            var points = [{x: x, y: y}];
            for (var i = 0; i < segments; i++) {
                angle += (Math.random() - 0.5) * 1.2;
                var step = 6 + Math.random() * 10;
                x += Math.cos(angle) * step;
                y += Math.sin(angle) * step;
                points.push({x: x, y: y});
                ctx.lineTo(x, y);
            }
            ctx.stroke();
            
            // Heller Kern
            ctx.globalAlpha = 0.9;
            ctx.strokeStyle = crackColor;
            ctx.lineWidth = thickness;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (var i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
            
            // Weißer Innenkern für extra Hitze
            ctx.globalAlpha = 0.4;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = thickness * 0.3;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (var i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
            
            // Verzweigungen
            if (depth > 1) {
                for (var i = 0; i < 2; i++) {
                    var branchIdx = Math.floor(Math.random() * points.length);
                    var branchAngle = angle + (Math.random() - 0.5) * 2.5;
                    drawCrack(points[branchIdx].x, points[branchIdx].y, branchAngle, 
                              length * 0.5, thickness * 0.6, depth - 1);
                }
            }
        }
        
        // 3-4 Hauptrisse von verschiedenen Seiten
        drawCrack(0, height * 0.3, 0.3, width * 0.7, 2.5, 3);
        drawCrack(width, height * 0.6, Math.PI + 0.5, width * 0.6, 2, 3);
        drawCrack(width * 0.5, 0, Math.PI / 2 + 0.3, height * 0.5, 1.8, 2);
        drawCrack(width * 0.3, height, -Math.PI / 2 - 0.2, height * 0.4, 1.5, 2);
        
        ctx.globalAlpha = 1.0;
    }
    
    // RIFT PRO: Frost/Ice Crystal Texture
    function generateFrostTexture(ctx, width, height, baseColor, crystalColor, accentColor) {
        // Eisige Basis
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);
        
        // Subtiler radialer Gradient für Tiefe
        var centerGrad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.7);
        centerGrad.addColorStop(0, 'rgba(255,255,255,0.1)');
        centerGrad.addColorStop(1, 'rgba(0,0,0,0.05)');
        ctx.fillStyle = centerGrad;
        ctx.fillRect(0, 0, width, height);
        
        // Eiskristall-Äste zeichnen
        function drawFrostBranch(x, y, angle, length, thickness, depth) {
            if (depth <= 0 || length < 3) return;
            
            var endX = x + Math.cos(angle) * length;
            var endY = y + Math.sin(angle) * length;
            
            // Glow
            ctx.globalAlpha = 0.15;
            ctx.strokeStyle = accentColor || crystalColor;
            ctx.lineWidth = thickness * 2.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            
            // Hauptlinie
            ctx.globalAlpha = 0.5 + depth * 0.1;
            ctx.strokeStyle = crystalColor;
            ctx.lineWidth = thickness;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            
            // Highlight
            ctx.globalAlpha = 0.3;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = thickness * 0.3;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            
            // Verzweigungen in 60°-Winkeln (Schneekristall-Muster)
            if (depth > 1) {
                var branches = 2 + Math.floor(Math.random() * 2);
                for (var i = 0; i < branches; i++) {
                    var pos = 0.3 + Math.random() * 0.5;
                    var bx = x + (endX - x) * pos;
                    var by = y + (endY - y) * pos;
                    var bAngle = angle + (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 3 + (Math.random() - 0.5) * 0.4);
                    drawFrostBranch(bx, by, bAngle, length * 0.45, thickness * 0.6, depth - 1);
                }
            }
        }
        
        // Mehrere Kristall-Ursprünge
        for (var i = 0; i < 4; i++) {
            var sx = Math.random() * width;
            var sy = Math.random() * height;
            var numArms = 3 + Math.floor(Math.random() * 3);
            for (var a = 0; a < numArms; a++) {
                var angle = (a / numArms) * Math.PI * 2 + Math.random() * 0.3;
                drawFrostBranch(sx, sy, angle, width * 0.25, 1.5, 3);
            }
        }
        
        // Glitzerpunkte
        for (var i = 0; i < 30; i++) {
            ctx.globalAlpha = 0.3 + Math.random() * 0.5;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(Math.random() * width, Math.random() * height, 0.5 + Math.random() * 1, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.globalAlpha = 1.0;
    }
    
    // RIFT PRO: Border/Frame Texture
    function generateBorderTexture(ctx, width, height, baseColor, borderColor) {
        // Basis-Farbe
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);
        
        var borderWidth = Math.max(8, width * 0.06);
        var inset = borderWidth * 0.5;
        
        // Äußerer Rahmen Glow
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = borderWidth * 2;
        ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
        
        // Hauptrahmen
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = borderWidth;
        ctx.strokeRect(inset + borderWidth * 0.5, inset + borderWidth * 0.5, 
                        width - inset * 2 - borderWidth, height - inset * 2 - borderWidth);
        
        // Innerer Highlight-Strich
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = borderWidth * 0.2;
        var innerInset = inset + borderWidth * 0.3;
        ctx.strokeRect(innerInset, innerInset, width - innerInset * 2, height - innerInset * 2);
        
        // Eckverzierungen (kleine Dreiecke in den Ecken)
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = borderColor;
        var cs = borderWidth * 1.2;
        // Oben-links
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(cs, 0); ctx.lineTo(0, cs); ctx.closePath(); ctx.fill();
        // Oben-rechts
        ctx.beginPath(); ctx.moveTo(width, 0); ctx.lineTo(width - cs, 0); ctx.lineTo(width, cs); ctx.closePath(); ctx.fill();
        // Unten-links
        ctx.beginPath(); ctx.moveTo(0, height); ctx.lineTo(cs, height); ctx.lineTo(0, height - cs); ctx.closePath(); ctx.fill();
        // Unten-rechts
        ctx.beginPath(); ctx.moveTo(width, height); ctx.lineTo(width - cs, height); ctx.lineTo(width, height - cs); ctx.closePath(); ctx.fill();
        
        ctx.globalAlpha = 1.0;
    }
    
    // RIFT PRO: Lightning/Blitz Texture
    function generateLightningTexture(ctx, width, height, baseColor, boltColor, glowColor) {
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);
        
        function drawBolt(x1, y1, x2, y2, thickness, depth) {
            if (depth <= 0) return;
            
            var midX = (x1 + x2) / 2 + (Math.random() - 0.5) * Math.abs(x2 - x1) * 0.5;
            var midY = (y1 + y2) / 2 + (Math.random() - 0.5) * Math.abs(y2 - y1) * 0.5;
            
            if (depth === 1) {
                // Glow layer
                ctx.globalAlpha = 0.2;
                ctx.strokeStyle = glowColor || boltColor;
                ctx.lineWidth = thickness * 4;
                ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(midX, midY); ctx.lineTo(x2, y2); ctx.stroke();
                
                // Main bolt
                ctx.globalAlpha = 0.85;
                ctx.strokeStyle = boltColor;
                ctx.lineWidth = thickness;
                ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(midX, midY); ctx.lineTo(x2, y2); ctx.stroke();
                
                // Hot core
                ctx.globalAlpha = 0.5;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = thickness * 0.3;
                ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(midX, midY); ctx.lineTo(x2, y2); ctx.stroke();
                return;
            }
            
            drawBolt(x1, y1, midX, midY, thickness, depth - 1);
            drawBolt(midX, midY, x2, y2, thickness, depth - 1);
            
            // Branch
            if (Math.random() > 0.4) {
                var bAngle = Math.atan2(y2 - y1, x2 - x1) + (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.8);
                var bLen = Math.sqrt((x2-x1)*(x2-x1) + (y2-y1)*(y2-y1)) * 0.3;
                drawBolt(midX, midY, midX + Math.cos(bAngle) * bLen, midY + Math.sin(bAngle) * bLen, thickness * 0.6, depth - 1);
            }
        }
        
        // 2-3 main bolts crossing the face
        drawBolt(width * 0.1, 0, width * 0.8, height, 2.0, 4);
        drawBolt(width * 0.9, height * 0.1, width * 0.2, height * 0.9, 1.5, 3);
        if (Math.random() > 0.3) drawBolt(0, height * 0.5, width, height * 0.4, 1.2, 3);
        
        // Ambient electric glow spots
        for (var i = 0; i < 4; i++) {
            var gx = Math.random() * width, gy = Math.random() * height;
            var gRad = ctx.createRadialGradient(gx, gy, 0, gx, gy, 15 + Math.random() * 20);
            gRad.addColorStop(0, glowColor || boltColor);
            gRad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = 0.08;
            ctx.fillStyle = gRad;
            ctx.fillRect(0, 0, width, height);
        }
        
        ctx.globalAlpha = 1.0;
    }
    
    // RIFT PRO: Dragon Scale Texture
    function generateDragonScaleTexture(ctx, width, height, baseColor, scaleColor, highlightColor) {
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);
        
        var scaleW = width / 6;
        var scaleH = height / 5;
        
        for (var row = -1; row < 7; row++) {
            for (var col = -1; col < 8; col++) {
                var x = col * scaleW + (row % 2 ? scaleW * 0.5 : 0);
                var y = row * scaleH * 0.75;
                
                // Scale shape (rounded arch)
                ctx.beginPath();
                ctx.moveTo(x, y + scaleH);
                ctx.quadraticCurveTo(x, y, x + scaleW / 2, y);
                ctx.quadraticCurveTo(x + scaleW, y, x + scaleW, y + scaleH);
                ctx.closePath();
                
                // Scale fill with subtle variation
                var variation = 0.85 + Math.random() * 0.3;
                ctx.globalAlpha = 0.25 * variation;
                ctx.fillStyle = scaleColor;
                ctx.fill();
                
                // Scale edge
                ctx.globalAlpha = 0.35;
                ctx.strokeStyle = scaleColor;
                ctx.lineWidth = 1;
                ctx.stroke();
                
                // Highlight on top edge
                ctx.globalAlpha = 0.15;
                ctx.strokeStyle = highlightColor || '#ffffff';
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(x + scaleW * 0.15, y + scaleH * 0.3);
                ctx.quadraticCurveTo(x + scaleW / 2, y - scaleH * 0.05, x + scaleW * 0.85, y + scaleH * 0.3);
                ctx.stroke();
            }
        }
        
        ctx.globalAlpha = 1.0;
    }
    
    // RIFT PRO: Runic/Arcane Texture
    function generateRunicTexture(ctx, width, height, baseColor, runeColor, glowColor) {
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);
        
        // Faint magic circle in center
        var cx = width / 2, cy = height / 2;
        var circleR = Math.min(width, height) * 0.35;
        
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = runeColor;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, circleR, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, circleR * 0.7, 0, Math.PI * 2); ctx.stroke();
        
        // Inscribed polygon
        ctx.globalAlpha = 0.1;
        var sides = 5 + Math.floor(Math.random() * 3);
        ctx.beginPath();
        for (var i = 0; i <= sides; i++) {
            var angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
            var px = cx + Math.cos(angle) * circleR * 0.85;
            var py = cy + Math.sin(angle) * circleR * 0.85;
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke();
        
        // Random rune-like symbols scattered
        function drawRune(rx, ry, size) {
            var type = Math.floor(Math.random() * 6);
            ctx.save();
            ctx.translate(rx, ry);
            ctx.rotate(Math.random() * Math.PI * 2);
            ctx.beginPath();
            
            switch(type) {
                case 0: // Vertical with cross
                    ctx.moveTo(0, -size); ctx.lineTo(0, size);
                    ctx.moveTo(-size*0.5, -size*0.3); ctx.lineTo(size*0.5, size*0.3);
                    break;
                case 1: // Triangle
                    ctx.moveTo(0, -size); ctx.lineTo(size*0.7, size*0.5); ctx.lineTo(-size*0.7, size*0.5); ctx.closePath();
                    break;
                case 2: // Diamond
                    ctx.moveTo(0, -size); ctx.lineTo(size*0.5, 0); ctx.lineTo(0, size); ctx.lineTo(-size*0.5, 0); ctx.closePath();
                    break;
                case 3: // Arrow
                    ctx.moveTo(0, -size); ctx.lineTo(0, size);
                    ctx.moveTo(-size*0.4, -size*0.4); ctx.lineTo(0, -size); ctx.lineTo(size*0.4, -size*0.4);
                    break;
                case 4: // Zigzag
                    ctx.moveTo(-size*0.5, -size); ctx.lineTo(size*0.5, -size*0.3);
                    ctx.lineTo(-size*0.5, size*0.3); ctx.lineTo(size*0.5, size);
                    break;
                case 5: // Circle with dot
                    ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
                    ctx.moveTo(2, 0); ctx.arc(0, 0, 2, 0, Math.PI * 2);
                    break;
            }
            ctx.stroke();
            ctx.restore();
        }
        
        // Glow pass for runes
        ctx.strokeStyle = glowColor || runeColor;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.06;
        for (var i = 0; i < 8; i++) {
            drawRune(Math.random() * width, Math.random() * height, 6 + Math.random() * 10);
        }
        
        // Sharp pass
        ctx.strokeStyle = runeColor;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.25;
        for (var i = 0; i < 8; i++) {
            drawRune(Math.random() * width, Math.random() * height, 6 + Math.random() * 10);
        }
        
        // Center glow
        var centerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, circleR);
        centerGlow.addColorStop(0, glowColor || runeColor);
        centerGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = centerGlow;
        ctx.fillRect(0, 0, width, height);
        
        ctx.globalAlpha = 1.0;
    }
    
    // RIFT PRO: Circuit Board Texture
    function generateCircuitTexture(ctx, width, height, baseColor, traceColor, glowColor) {
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);
        
        var gridSize = Math.min(width, height) / 8;
        
        function drawTrace(startX, startY, length) {
            var x = startX, y = startY;
            ctx.beginPath();
            ctx.moveTo(x, y);
            
            for (var i = 0; i < length; i++) {
                var dir = Math.floor(Math.random() * 4);
                switch(dir) {
                    case 0: x += gridSize; break;
                    case 1: x -= gridSize; break;
                    case 2: y += gridSize; break;
                    case 3: y -= gridSize; break;
                }
                x = Math.max(0, Math.min(width, x));
                y = Math.max(0, Math.min(height, y));
                ctx.lineTo(x, y);
            }
            ctx.stroke();
            
            // Node/pad at end
            ctx.beginPath();
            ctx.arc(x, y, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Glow layer
        ctx.strokeStyle = glowColor || traceColor;
        ctx.fillStyle = glowColor || traceColor;
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.08;
        for (var i = 0; i < 10; i++) {
            drawTrace(Math.random() * width, Math.random() * height, 3 + Math.floor(Math.random() * 5));
        }
        
        // Main traces
        ctx.strokeStyle = traceColor;
        ctx.fillStyle = traceColor;
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.3;
        for (var i = 0; i < 10; i++) {
            drawTrace(Math.random() * width, Math.random() * height, 3 + Math.floor(Math.random() * 5));
        }
        
        // Connection pads
        ctx.globalAlpha = 0.25;
        for (var i = 0; i < 6; i++) {
            var px = Math.round(Math.random() * 6) * gridSize;
            var py = Math.round(Math.random() * 6) * gridSize;
            ctx.fillStyle = traceColor;
            ctx.fillRect(px - 3, py - 3, 6, 6);
        }
        
        // Subtle grid dots
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = traceColor;
        for (var gx = 0; gx < width; gx += gridSize) {
            for (var gy = 0; gy < height; gy += gridSize) {
                ctx.beginPath();
                ctx.arc(gx, gy, 0.8, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        ctx.globalAlpha = 1.0;
    }
    
    // RIFT PRO: Procedural Environment Map for reflective materials (Chrome, Crystal, Gems)
    var _proceduralEnvMap = null;
    function getProceduralEnvMap() {
        if (_proceduralEnvMap) return _proceduralEnvMap;
        
        var size = 128;
        var canvases = [];
        
        // 6 cube faces: +X, -X, +Y (top), -Y (bottom), +Z, -Z
        for (var face = 0; face < 6; face++) {
            var canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            var ctx = canvas.getContext('2d');
            
            var grd;
            if (face === 2) {
                // +Y (top) - bright area simulating overhead light/sky
                grd = ctx.createRadialGradient(size * 0.5, size * 0.5, 0, size * 0.5, size * 0.5, size * 0.7);
                grd.addColorStop(0, '#e0e4f0');
                grd.addColorStop(0.3, '#a0a8b8');
                grd.addColorStop(0.7, '#505868');
                grd.addColorStop(1, '#303840');
                ctx.fillStyle = grd;
                ctx.fillRect(0, 0, size, size);
                // Add soft overhead glow (no sharp spot)
                var spot = ctx.createRadialGradient(size * 0.4, size * 0.4, 0, size * 0.4, size * 0.4, size * 0.35);
                spot.addColorStop(0, 'rgba(255,255,255,0.3)');
                spot.addColorStop(0.5, 'rgba(255,255,255,0.1)');
                spot.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = spot;
                ctx.fillRect(0, 0, size, size);
            } else if (face === 3) {
                // -Y (bottom) - dark ground/table surface
                grd = ctx.createRadialGradient(size * 0.5, size * 0.5, 0, size * 0.5, size * 0.5, size * 0.7);
                grd.addColorStop(0, '#1a1c22');
                grd.addColorStop(1, '#08090c');
                ctx.fillStyle = grd;
                ctx.fillRect(0, 0, size, size);
            } else {
                // Sides - gradient from bright (top) to dark (bottom) with subtle variation
                grd = ctx.createLinearGradient(0, 0, 0, size);
                grd.addColorStop(0, '#6a7080');
                grd.addColorStop(0.3, '#404850');
                grd.addColorStop(0.6, '#282c34');
                grd.addColorStop(1, '#101218');
                ctx.fillStyle = grd;
                ctx.fillRect(0, 0, size, size);
                // Subtle horizontal variation per face for non-uniform look
                var hShift = (face * 37) % 100; // pseudo-random per face
                var hGlow = ctx.createRadialGradient(
                    size * (0.3 + hShift / 200), size * 0.25, 0,
                    size * 0.5, size * 0.4, size * 0.5
                );
                hGlow.addColorStop(0, 'rgba(140,150,170,0.15)');
                hGlow.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = hGlow;
                ctx.fillRect(0, 0, size, size);
            }
            
            canvases.push(canvas);
        }
        
        _proceduralEnvMap = new THREE.CubeTexture(canvases);
        _proceduralEnvMap.needsUpdate = true;
        return _proceduralEnvMap;
    }
    
    function create_dice_materials(face_labels, size, margin, useGradient) {
        // Default: use gradient if available (but can be disabled for d10)
        if (useGradient === undefined) useGradient = true;
        
        // RIFT: Determine background color - use middle gradient color if gradient disabled but available
        var backgroundColor = vars.dice_color;
        if (!useGradient && vars.dice_gradient && vars.dice_gradient.colors && vars.dice_gradient.colors.length > 0) {
            // Use middle color from gradient for better visual consistency
            var midIndex = Math.floor(vars.dice_gradient.colors.length / 2);
            backgroundColor = vars.dice_gradient.colors[midIndex];
        }
        
        function create_text_texture(text, color, back_color) {
            if (text == undefined) return null;
            var canvas = document.createElement("canvas");
            var context = canvas.getContext("2d");
            var ts = calc_texture_size(size + size * 2 * margin) * 2;
            canvas.width = canvas.height = ts;
            context.font = ts / (1 + 2 * margin) + "pt Arial";
            
            // RIFT: Texture Support
            if (vars.dice_texture && vars.dice_texture.type) {
                var tex = vars.dice_texture;
                switch(tex.type) {
                    case 'marble':
                        generateMarbleTexture(context, ts, ts, tex.baseColor || back_color, tex.veinColor || '#ffffff');
                        break;
                    case 'crystal':
                        generateCrystalTexture(context, ts, ts, tex.baseColor || back_color, tex.veinColor || '#ffffff');
                        break;
                    case 'gem':
                        generateGemTexture(context, ts, ts, tex.baseColor || back_color, tex.veinColor || '#ffffff');
                        break;
                    case 'lava':
                        generateLavaTexture(context, ts, ts, tex.baseColor || back_color, tex.glowColor || '#ff4400');
                        break;
                    case 'pearlescent':
                        generatePearlescentTexture(context, ts, ts, tex.baseColor || back_color, tex.shimmerColor || '#ffccee');
                        break;
                    case 'toxic':
                        generateToxicTexture(context, ts, ts, tex.baseColor || back_color, tex.neonColor || '#44ff44');
                        break;
                    case 'patina':
                        generatePatinaTexture(context, ts, ts, tex.baseColor || back_color, tex.patinaColor || '#44aa88');
                        break;
                    case 'celestial':
                        generateCelestialTexture(context, ts, ts, tex.baseColor || back_color, tex.highlightColor || '#ccccdd');
                        break;
                    case 'wood':
                        generateWoodTexture(context, ts, ts, tex.baseColor || back_color, tex.grainColor || '#3d2817');
                        break;
                    case 'stone':
                        generateStoneTexture(context, ts, ts, tex.baseColor || back_color, tex.speckleColor || '#666666');
                        break;
                    case 'leather':
                        generateLeatherTexture(context, ts, ts, tex.baseColor || back_color, tex.grainColor || '#2a1a0a');
                        break;
                    case 'metal':
                        generateMetalBrushedTexture(context, ts, ts, tex.baseColor || back_color, tex.brushColor || '#ffffff');
                        break;
                    case 'galaxy':
                        generateGalaxyTexture(context, ts, ts, tex.baseColor || '#0a0a14', tex.nebulaColor1 || '#4400aa', tex.nebulaColor2 || '#0066cc');
                        break;
                    case 'frost':
                        generateFrostTexture(context, ts, ts, tex.baseColor || '#e8f0f8', tex.crystalColor || '#88ccee', tex.accentColor || '#aaddff');
                        break;
                    case 'border':
                        generateBorderTexture(context, ts, ts, tex.baseColor || back_color, tex.borderColor || '#ffd700');
                        break;
                    case 'lightning':
                        generateLightningTexture(context, ts, ts, tex.baseColor || '#0a0a0e', tex.boltColor || '#88aaff', tex.glowColor || '#4466ff');
                        break;
                    case 'dragonscale':
                        generateDragonScaleTexture(context, ts, ts, tex.baseColor || '#1a0808', tex.scaleColor || '#660000', tex.highlightColor || '#ff4444');
                        break;
                    case 'runic':
                        generateRunicTexture(context, ts, ts, tex.baseColor || '#0a0a0a', tex.runeColor || '#ffd700', tex.glowColor || '#ffaa00');
                        break;
                    default:
                        context.fillStyle = back_color;
                        context.fillRect(0, 0, canvas.width, canvas.height);
                }
            }
            // RIFT: Gradient Support (can be disabled for d10 to avoid seam visibility)
            else if (useGradient && vars.dice_gradient && vars.dice_gradient.colors && vars.dice_gradient.colors.length > 0) {
                var gradient;
                var colors = vars.dice_gradient.colors;
                
                if (vars.dice_gradient.type === 'radial') {
                    // Radial gradient from center
                    gradient = context.createRadialGradient(
                        canvas.width / 2, canvas.height / 2, 0,
                        canvas.width / 2, canvas.height / 2, canvas.width / 2
                    );
                } else {
                    // Linear gradient (diagonal for more dynamic look)
                    gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
                }
                
                // Add color stops
                var stops = vars.dice_gradient.stops || colors.map(function(_, i) { 
                    return i / (colors.length - 1); 
                });
                for (var j = 0; j < colors.length; j++) {
                    gradient.addColorStop(stops[j] || j / (colors.length - 1), colors[j]);
                }
                
                context.fillStyle = gradient;
                context.fillRect(0, 0, canvas.width, canvas.height);
            } else {
                context.fillStyle = back_color;
                context.fillRect(0, 0, canvas.width, canvas.height);
            }
            
            context.textAlign = "center";
            context.textBaseline = "middle";
            
            // RIFT: Premium text styles
            if (vars.dice_text_style === 'emboss') {
                var cx = canvas.width / 2, cy = canvas.height / 2;
                var off = ts * 0.02;
                // Strong dark shadow below-right
                context.fillStyle = 'rgba(0,0,0,0.7)';
                context.fillText(text, cx + off, cy + off);
                // Medium dark layer
                context.fillStyle = 'rgba(0,0,0,0.35)';
                context.fillText(text, cx + off * 0.5, cy + off * 0.5);
                // Bright highlight top-left
                context.fillStyle = 'rgba(255,255,255,0.6)';
                context.fillText(text, cx - off * 0.6, cy - off * 0.6);
                // Main text
                context.fillStyle = color;
                context.fillText(text, cx, cy);
                // Top specular pass
                context.save();
                context.globalAlpha = 0.12;
                context.fillStyle = '#ffffff';
                context.fillText(text, cx - off * 0.2, cy - off * 0.2);
                context.restore();
            } else if (vars.dice_text_style === 'engrave') {
                var cx = canvas.width / 2, cy = canvas.height / 2;
                var off = ts * 0.014;
                // Light edge top-left (light catching the carved edge)
                context.fillStyle = 'rgba(255,255,255,0.35)';
                context.fillText(text, cx - off, cy - off);
                // Dark inner shadow bottom-right (depth of the carving)
                context.fillStyle = 'rgba(0,0,0,0.45)';
                context.fillText(text, cx + off * 0.6, cy + off * 0.6);
                // Main text slightly darker than surface
                context.fillStyle = color;
                context.globalAlpha = 0.85;
                context.fillText(text, cx, cy);
                context.globalAlpha = 1.0;
            } else if (vars.dice_text_style === 'neon') {
                var neonColor = vars.dice_neon_color || color;
                // Äußerer Glow (breit + transparent)
                context.save();
                context.shadowColor = neonColor;
                context.shadowBlur = ts * 0.12;
                context.shadowOffsetX = 0;
                context.shadowOffsetY = 0;
                context.fillStyle = neonColor;
                context.fillText(text, canvas.width / 2, canvas.height / 2);
                // Zweiter Glow-Pass für Intensität
                context.shadowBlur = ts * 0.06;
                context.fillText(text, canvas.width / 2, canvas.height / 2);
                context.restore();
                // Heller Kern
                context.fillStyle = '#ffffff';
                context.globalAlpha = 0.9;
                context.fillText(text, canvas.width / 2, canvas.height / 2);
                context.globalAlpha = 1.0;
            } else if (vars.dice_text_style === 'metallic') {
                var color2 = vars.dice_text_color2 || '#333333';
                var cx = canvas.width / 2, cy = canvas.height / 2;
                // Realistic metallic: curved highlight gradient (bright top, dark middle, bright bottom edge)
                var grad = context.createLinearGradient(cx, cy - ts * 0.22, cx, cy + ts * 0.22);
                grad.addColorStop(0, color);
                grad.addColorStop(0.15, '#ffffff');  // specular highlight near top
                grad.addColorStop(0.35, color);
                grad.addColorStop(0.55, color2);     // dark shadow in middle-lower
                grad.addColorStop(0.75, color);
                grad.addColorStop(0.9, color2);
                grad.addColorStop(1, color);
                // Drop shadow
                context.fillStyle = 'rgba(0,0,0,0.4)';
                context.fillText(text, cx + ts * 0.01, cy + ts * 0.012);
                // Main metallic gradient
                context.fillStyle = grad;
                context.fillText(text, cx, cy);
                // Bright specular line across top third
                context.save();
                var specGrad = context.createLinearGradient(cx, cy - ts * 0.18, cx, cy - ts * 0.04);
                specGrad.addColorStop(0, 'rgba(255,255,255,0)');
                specGrad.addColorStop(0.4, 'rgba(255,255,255,0.4)');
                specGrad.addColorStop(1, 'rgba(255,255,255,0)');
                context.fillStyle = specGrad;
                context.fillText(text, cx, cy);
                context.restore();
            } else if (vars.dice_text_style === 'outline') {
                var strokeColor = vars.dice_text_color2 || '#000000';
                var cx = canvas.width / 2, cy = canvas.height / 2;
                // Thick outer stroke
                context.strokeStyle = strokeColor;
                context.lineWidth = ts * 0.045;
                context.lineJoin = 'round';
                context.strokeText(text, cx, cy);
                // Fill
                context.fillStyle = color;
                context.fillText(text, cx, cy);
            } else {
                context.fillStyle = color;
                context.fillText(text, canvas.width / 2, canvas.height / 2);
            }
            if (text == '6' || text == '9') {
                context.fillText('  .', canvas.width / 2, canvas.height / 2);
            }
            var texture = new THREE.Texture(canvas);
            texture.needsUpdate = true;
            return texture;
        }
        var materials = [];
        for (var i = 0; i < face_labels.length; ++i) {
            var matOptions = $t.copyto(vars.material_options,
                { map: create_text_texture(face_labels[i], vars.label_color, backgroundColor) });
            
            // RIFT: Per-theme material overrides (metallic, glass, gem, etc.)
            if (vars.dice_material_override) {
                var ov = vars.dice_material_override;
                if (ov.shininess !== undefined) matOptions.shininess = ov.shininess;
                if (ov.specular !== undefined) matOptions.specular = ov.specular;
                if (ov.emissive !== undefined) matOptions.emissive = ov.emissive;
                if (ov.opacity !== undefined) matOptions.opacity = ov.opacity;
                if (ov.transparent !== undefined) matOptions.transparent = ov.transparent;
                if (ov.side !== undefined) matOptions.side = ov.side;
                if (ov.shading !== undefined) matOptions.shading = ov.shading;
                if (ov.depthWrite !== undefined) matOptions.depthWrite = ov.depthWrite;
                if (ov.envMap) { matOptions.envMap = getProceduralEnvMap(); matOptions.combine = ov.combine || THREE.MixOperation; }
                if (ov.reflectivity !== undefined) matOptions.reflectivity = ov.reflectivity;
            }
            
            materials.push(new THREE.MeshPhongMaterial(matOptions));
        }
        return materials;
    }

    function create_d4_materials(size, margin, labels) {
        function create_d4_text(text, color, back_color) {
            var canvas = document.createElement("canvas");
            var context = canvas.getContext("2d");
            var ts = calc_texture_size(size + margin) * 2;
            canvas.width = canvas.height = ts;
            context.font = (ts - margin) * 0.5 + "pt Arial";
            
            // RIFT: Texture Support
            if (vars.dice_texture && vars.dice_texture.type) {
                var tex = vars.dice_texture;
                switch(tex.type) {
                    case 'marble':
                        generateMarbleTexture(context, ts, ts, tex.baseColor || back_color, tex.veinColor || '#ffffff');
                        break;
                    case 'crystal':
                        generateCrystalTexture(context, ts, ts, tex.baseColor || back_color, tex.veinColor || '#ffffff');
                        break;
                    case 'gem':
                        generateGemTexture(context, ts, ts, tex.baseColor || back_color, tex.veinColor || '#ffffff');
                        break;
                    case 'lava':
                        generateLavaTexture(context, ts, ts, tex.baseColor || back_color, tex.glowColor || '#ff4400');
                        break;
                    case 'pearlescent':
                        generatePearlescentTexture(context, ts, ts, tex.baseColor || back_color, tex.shimmerColor || '#ffccee');
                        break;
                    case 'toxic':
                        generateToxicTexture(context, ts, ts, tex.baseColor || back_color, tex.neonColor || '#44ff44');
                        break;
                    case 'patina':
                        generatePatinaTexture(context, ts, ts, tex.baseColor || back_color, tex.patinaColor || '#44aa88');
                        break;
                    case 'celestial':
                        generateCelestialTexture(context, ts, ts, tex.baseColor || back_color, tex.highlightColor || '#ccccdd');
                        break;
                    case 'wood':
                        generateWoodTexture(context, ts, ts, tex.baseColor || back_color, tex.grainColor || '#3d2817');
                        break;
                    case 'stone':
                        generateStoneTexture(context, ts, ts, tex.baseColor || back_color, tex.speckleColor || '#666666');
                        break;
                    case 'leather':
                        generateLeatherTexture(context, ts, ts, tex.baseColor || back_color, tex.grainColor || '#2a1a0a');
                        break;
                    case 'metal':
                        generateMetalBrushedTexture(context, ts, ts, tex.baseColor || back_color, tex.brushColor || '#ffffff');
                        break;
                    case 'galaxy':
                        generateGalaxyTexture(context, ts, ts, tex.baseColor || '#0a0a14', tex.nebulaColor1 || '#4400aa', tex.nebulaColor2 || '#0066cc');
                        break;
                    case 'frost':
                        generateFrostTexture(context, ts, ts, tex.baseColor || '#e8f0f8', tex.crystalColor || '#88ccee', tex.accentColor || '#aaddff');
                        break;
                    case 'border':
                        generateBorderTexture(context, ts, ts, tex.baseColor || back_color, tex.borderColor || '#ffd700');
                        break;
                    case 'lightning':
                        generateLightningTexture(context, ts, ts, tex.baseColor || '#0a0a0e', tex.boltColor || '#88aaff', tex.glowColor || '#4466ff');
                        break;
                    case 'dragonscale':
                        generateDragonScaleTexture(context, ts, ts, tex.baseColor || '#1a0808', tex.scaleColor || '#660000', tex.highlightColor || '#ff4444');
                        break;
                    case 'runic':
                        generateRunicTexture(context, ts, ts, tex.baseColor || '#0a0a0a', tex.runeColor || '#ffd700', tex.glowColor || '#ffaa00');
                        break;
                    default:
                        context.fillStyle = back_color;
                        context.fillRect(0, 0, canvas.width, canvas.height);
                }
            }
            // RIFT: Gradient Support
            else if (vars.dice_gradient && vars.dice_gradient.colors && vars.dice_gradient.colors.length > 0) {
                var gradient;
                var colors = vars.dice_gradient.colors;
                
                if (vars.dice_gradient.type === 'radial') {
                    gradient = context.createRadialGradient(
                        canvas.width / 2, canvas.height / 2, 0,
                        canvas.width / 2, canvas.height / 2, canvas.width / 2
                    );
                } else {
                    gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
                }
                
                var stops = vars.dice_gradient.stops || colors.map(function(_, i) { 
                    return i / (colors.length - 1); 
                });
                for (var j = 0; j < colors.length; j++) {
                    gradient.addColorStop(stops[j] || j / (colors.length - 1), colors[j]);
                }
                
                context.fillStyle = gradient;
                context.fillRect(0, 0, canvas.width, canvas.height);
            } else {
                context.fillStyle = back_color;
                context.fillRect(0, 0, canvas.width, canvas.height);
            }
            
            context.textAlign = "center";
            context.textBaseline = "middle";
            
            // RIFT: D4 text with style support
            for (var i in text) {
                var cx = canvas.width / 2, cy = canvas.height / 2 - ts * 0.3;
                
                if (vars.dice_text_style === 'emboss') {
                    var off = ts * 0.02;
                    context.fillStyle = 'rgba(0,0,0,0.7)';
                    context.fillText(text[i], cx + off, cy + off);
                    context.fillStyle = 'rgba(0,0,0,0.35)';
                    context.fillText(text[i], cx + off * 0.5, cy + off * 0.5);
                    context.fillStyle = 'rgba(255,255,255,0.6)';
                    context.fillText(text[i], cx - off * 0.6, cy - off * 0.6);
                    context.fillStyle = color;
                    context.fillText(text[i], cx, cy);
                    context.save();
                    context.globalAlpha = 0.12;
                    context.fillStyle = '#ffffff';
                    context.fillText(text[i], cx - off * 0.2, cy - off * 0.2);
                    context.restore();
                } else if (vars.dice_text_style === 'engrave') {
                    var off = ts * 0.014;
                    context.fillStyle = 'rgba(255,255,255,0.35)';
                    context.fillText(text[i], cx - off, cy - off);
                    context.fillStyle = 'rgba(0,0,0,0.45)';
                    context.fillText(text[i], cx + off * 0.6, cy + off * 0.6);
                    context.fillStyle = color;
                    context.globalAlpha = 0.85;
                    context.fillText(text[i], cx, cy);
                    context.globalAlpha = 1.0;
                } else if (vars.dice_text_style === 'neon') {
                    var neonColor = vars.dice_neon_color || color;
                    context.save();
                    context.shadowColor = neonColor;
                    context.shadowBlur = ts * 0.12;
                    context.shadowOffsetX = 0; context.shadowOffsetY = 0;
                    context.fillStyle = neonColor;
                    context.fillText(text[i], cx, cy);
                    context.shadowBlur = ts * 0.06;
                    context.fillText(text[i], cx, cy);
                    context.restore();
                    context.fillStyle = '#ffffff';
                    context.globalAlpha = 0.9;
                    context.fillText(text[i], cx, cy);
                    context.globalAlpha = 1.0;
                } else if (vars.dice_text_style === 'metallic') {
                    var color2 = vars.dice_text_color2 || '#333333';
                    var grad = context.createLinearGradient(cx, cy - ts * 0.22, cx, cy + ts * 0.22);
                    grad.addColorStop(0, color);
                    grad.addColorStop(0.15, '#ffffff');
                    grad.addColorStop(0.35, color);
                    grad.addColorStop(0.55, color2);
                    grad.addColorStop(0.75, color);
                    grad.addColorStop(0.9, color2);
                    grad.addColorStop(1, color);
                    context.fillStyle = 'rgba(0,0,0,0.4)';
                    context.fillText(text[i], cx + ts * 0.01, cy + ts * 0.012);
                    context.fillStyle = grad;
                    context.fillText(text[i], cx, cy);
                    context.save();
                    var specGrad = context.createLinearGradient(cx, cy - ts * 0.18, cx, cy - ts * 0.04);
                    specGrad.addColorStop(0, 'rgba(255,255,255,0)');
                    specGrad.addColorStop(0.4, 'rgba(255,255,255,0.4)');
                    specGrad.addColorStop(1, 'rgba(255,255,255,0)');
                    context.fillStyle = specGrad;
                    context.fillText(text[i], cx, cy);
                    context.restore();
                } else if (vars.dice_text_style === 'outline') {
                    var strokeColor = vars.dice_text_color2 || '#000000';
                    context.strokeStyle = strokeColor;
                    context.lineWidth = ts * 0.045;
                    context.lineJoin = 'round';
                    context.strokeText(text[i], cx, cy);
                    context.fillStyle = color;
                    context.fillText(text[i], cx, cy);
                } else {
                    context.fillStyle = color;
                    context.fillText(text[i], cx, cy);
                }
                
                context.translate(canvas.width / 2, canvas.height / 2);
                context.rotate(Math.PI * 2 / 3);
                context.translate(-canvas.width / 2, -canvas.height / 2);
            }
            var texture = new THREE.Texture(canvas);
            texture.needsUpdate = true;
            return texture;
        }
        var materials = [];
        for (var i = 0; i < labels.length; ++i) {
            var matOptions = $t.copyto(vars.material_options,
                { map: create_d4_text(labels[i], vars.label_color, vars.dice_color) });
            
            if (vars.dice_material_override) {
                var ov = vars.dice_material_override;
                if (ov.shininess !== undefined) matOptions.shininess = ov.shininess;
                if (ov.specular !== undefined) matOptions.specular = ov.specular;
                if (ov.emissive !== undefined) matOptions.emissive = ov.emissive;
                if (ov.opacity !== undefined) matOptions.opacity = ov.opacity;
                if (ov.transparent !== undefined) matOptions.transparent = ov.transparent;
                if (ov.side !== undefined) matOptions.side = ov.side;
                if (ov.shading !== undefined) matOptions.shading = ov.shading;
                if (ov.depthWrite !== undefined) matOptions.depthWrite = ov.depthWrite;
                if (ov.envMap) { matOptions.envMap = getProceduralEnvMap(); matOptions.combine = ov.combine || THREE.MixOperation; }
                if (ov.reflectivity !== undefined) matOptions.reflectivity = ov.reflectivity;
            }
            
            materials.push(new THREE.MeshPhongMaterial(matOptions));
        }
        return materials;
    }

    function create_d4_geometry(radius) {
        var vertices = [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]];
        var faces = [[1, 0, 2, 1], [0, 1, 3, 2], [0, 3, 2, 3], [1, 2, 3, 4]];
        return create_geom(vertices, faces, radius, -0.1, Math.PI * 7 / 6, 0.96);
    }

    function create_d6_geometry(radius) {
        var vertices = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
                [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
        var faces = [[0, 3, 2, 1, 1], [1, 2, 6, 5, 2], [0, 1, 5, 4, 3],
                [3, 7, 6, 2, 4], [0, 4, 7, 3, 5], [4, 5, 6, 7, 6]];
        return create_geom(vertices, faces, radius, 0.1, Math.PI / 4, 0.96);
    }

    function create_d8_geometry(radius) {
        var vertices = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
        var faces = [[0, 2, 4, 1], [0, 4, 3, 2], [0, 3, 5, 3], [0, 5, 2, 4], [1, 3, 4, 5],
                [1, 4, 2, 6], [1, 2, 5, 7], [1, 5, 3, 8]];
        return create_geom(vertices, faces, radius, 0, -Math.PI / 4 / 2, 0.965);
    }

    function create_d10_geometry(radius) {
        var a = Math.PI * 2 / 10, h = 0.105;
        var vertices = [];
        for (var i = 0, b = 0; i < 10; ++i, b += a)
            vertices.push([Math.cos(b), Math.sin(b), h * (i % 2 ? 1 : -1)]);
        vertices.push([0, 0, -1]); // 10 = Südpol
        vertices.push([0, 0, 1]);  // 11 = Nordpol
        
        // RIFT FIX: Kite-Faces als 4-Eck-Quads statt 20 separate Dreiecke.
        // Jedes Quad = Pol → Ring-A → Ring-B → anderer Pol.
        // make_geom fan-trianguliert: 2 Triangles pro Quad, GLEICHER materialIndex.
        // → Textur/Gradient nahtlos über gesamte Kite-Fläche.
        var faces = [
            [11, 5, 6, 7, 0],   // Kite 0: N-Pol, ring5(up), ring6(down), ring7(up)
            [10, 4, 3, 2, 1],   // Kite 1: S-Pol, ring4(down), ring3(up), ring2(down)
            [11, 1, 2, 3, 2],   // Kite 2: N-Pol, ring1(up), ring2(down), ring3(up)
            [10, 0, 9, 8, 3],   // Kite 3: S-Pol, ring0(down), ring9(up), ring8(down)
            [11, 7, 8, 9, 4],   // Kite 4: N-Pol, ring7(up), ring8(down), ring9(up)
            [10, 8, 7, 6, 5],   // Kite 5: S-Pol, ring8(down), ring7(up), ring6(down)
            [11, 9, 0, 1, 6],   // Kite 6: N-Pol, ring9(up), ring0(down), ring1(up)
            [10, 2, 1, 0, 7],   // Kite 7: S-Pol, ring2(down), ring1(up), ring0(down)
            [11, 3, 4, 5, 8],   // Kite 8: N-Pol, ring3(up), ring4(down), ring5(up)
            [10, 6, 5, 4, 9],   // Kite 9: S-Pol, ring6(down), ring5(up), ring4(down)
        ];
        var geom = create_geom(vertices, faces, radius, 0, Math.PI * 6 / 5, 0.945);
        
        // RIFT FIX: Kite-UV-Korrektur
        // make_geom setzt reguläre Quadrat-UVs (aa=π/2), aber die Kite-Fläche ist
        // höher als breit → Text wird verzerrt. Fix: UVs aus echten 3D-Positionen
        // berechnen, damit gleiche Abstände in UV = gleiche Abstände auf der Fläche.
        var faceGroups = {};
        for (var i = 0; i < geom.faces.length; i++) {
            var mi = geom.faces[i].materialIndex;
            if (mi === 0) continue; // Chamfer-Flächen überspringen
            if (!faceGroups[mi]) faceGroups[mi] = [];
            faceGroups[mi].push(i);
        }
        
        for (var mi in faceGroups) {
            var triIndices = faceGroups[mi];
            
            // Sammle einzigartige Vertices dieser Kite-Fläche (2 Tris → 4 Verts)
            var vertMap = {}; // vertex-index → position im Array
            var verts = [];
            for (var t = 0; t < triIndices.length; t++) {
                var face = geom.faces[triIndices[t]];
                var abc = [face.a, face.b, face.c];
                for (var v = 0; v < 3; v++) {
                    var vi = abc[v];
                    if (vertMap[vi] === undefined) {
                        vertMap[vi] = verts.length;
                        verts.push(geom.vertices[vi]);
                    }
                }
            }
            
            // Face-Zentrum
            var center = new THREE.Vector3(0, 0, 0);
            for (var v = 0; v < verts.length; v++) center.add(verts[v]);
            center.divideScalar(verts.length);
            
            // Face-Normale (vom ersten Triangle)
            var normal = geom.faces[triIndices[0]].normal.clone().normalize();
            
            // Lokales 2D-Koordinatensystem auf der Face-Plane
            // "Oben" = Richtung zum Pol-Vertex (höchstes |z|) → konsistente Orientierung
            var poleVi = -1, maxAbsZ = -1;
            for (var vi in vertMap) {
                var absZ = Math.abs(geom.vertices[vi].z);
                if (absZ > maxAbsZ) { maxAbsZ = absZ; poleVi = parseInt(vi); }
            }
            var toPole = new THREE.Vector3().subVectors(geom.vertices[poleVi], center);
            // Auf Face-Plane projizieren
            var yAxis = toPole.clone().sub(normal.clone().multiplyScalar(toPole.dot(normal))).normalize();
            var xAxis = new THREE.Vector3().crossVectors(yAxis, normal).normalize();
            
            // Alle Vertices in 2D projizieren
            var coords = {};
            var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (var vi in vertMap) {
                var rel = new THREE.Vector3().subVectors(geom.vertices[vi], center);
                var x = rel.dot(xAxis);
                var y = rel.dot(yAxis);
                coords[vi] = { x: x, y: y };
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
            
            // UV-Mapping: Auf [0,1] skalieren MIT korrektem Aspect-Ratio
            var w = maxX - minX, h = maxY - minY;
            var scale = Math.max(w, h);
            var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
            
            // UVs auf Triangle-Faces anwenden
            for (var t = 0; t < triIndices.length; t++) {
                var fi = triIndices[t];
                var face = geom.faces[fi];
                var abc = [face.a, face.b, face.c];
                var uvs = [];
                for (var v = 0; v < 3; v++) {
                    var u0 = (coords[abc[v]].x - cx) / scale + 0.5;
                    var v0 = (coords[abc[v]].y - cy) / scale + 0.5;
                    uvs.push(new THREE.Vector2(u0, v0));
                }
                geom.faceVertexUvs[0][fi] = uvs;
            }
        }
        
        geom.uvsNeedUpdate = true;
        return geom;
    }

    function create_d12_geometry(radius) {
        var p = (1 + Math.sqrt(5)) / 2, q = 1 / p;
        var vertices = [[0, q, p], [0, q, -p], [0, -q, p], [0, -q, -p], [p, 0, q],
                [p, 0, -q], [-p, 0, q], [-p, 0, -q], [q, p, 0], [q, -p, 0], [-q, p, 0],
                [-q, -p, 0], [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1], [-1, 1, 1],
                [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]];
        var faces = [[2, 14, 4, 12, 0, 1], [15, 9, 11, 19, 3, 2], [16, 10, 17, 7, 6, 3], [6, 7, 19, 11, 18, 4],
                [6, 18, 2, 0, 16, 5], [18, 11, 9, 14, 2, 6], [1, 17, 10, 8, 13, 7], [1, 13, 5, 15, 3, 8],
                [13, 8, 12, 4, 5, 9], [5, 4, 14, 9, 15, 10], [0, 12, 8, 10, 16, 11], [3, 19, 7, 17, 1, 12]];
        return create_geom(vertices, faces, radius, 0.2, -Math.PI / 4 / 2, 0.968);
    }

    function create_d20_geometry(radius) {
        var t = (1 + Math.sqrt(5)) / 2;
        var vertices = [[-1, t, 0], [1, t, 0 ], [-1, -t, 0], [1, -t, 0],
                [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
                [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
        var faces = [[0, 11, 5, 1], [0, 5, 1, 2], [0, 1, 7, 3], [0, 7, 10, 4], [0, 10, 11, 5],
                [1, 5, 9, 6], [5, 11, 4, 7], [11, 10, 2, 8], [10, 7, 6, 9], [7, 1, 8, 10],
                [3, 9, 4, 11], [3, 4, 2, 12], [3, 2, 6, 13], [3, 6, 8, 14], [3, 8, 9, 15],
                [4, 9, 5, 16], [2, 4, 11, 17], [6, 2, 10, 18], [8, 6, 7, 19], [9, 8, 1, 20]];
        return create_geom(vertices, faces, radius, -0.2, -Math.PI / 4 / 2, 0.955);
    }

    // HELPERS

    function rnd() {
        return Math.random();
    }

    function create_shape(vertices, faces, radius) {
        var cv = new Array(vertices.length), cf = new Array(faces.length);
        for (var i = 0; i < vertices.length; ++i) {
            var v = vertices[i];
            cv[i] = new CANNON.Vec3(v.x * radius, v.y * radius, v.z * radius);
        }
        for (var i = 0; i < faces.length; ++i) {
            cf[i] = faces[i].slice(0, faces[i].length - 1);
        }
        return new CANNON.ConvexPolyhedron(cv, cf);
    }

    function make_geom(vertices, faces, radius, tab, af) {
        var geom = new THREE.Geometry();
        for (var i = 0; i < vertices.length; ++i) {
            var vertex = vertices[i].multiplyScalar(radius);
            vertex.index = geom.vertices.push(vertex) - 1;
        }
        for (var i = 0; i < faces.length; ++i) {
            var ii = faces[i], fl = ii.length - 1;
            var aa = Math.PI * 2 / fl;
            for (var j = 0; j < fl - 2; ++j) {
                geom.faces.push(new THREE.Face3(ii[0], ii[j + 1], ii[j + 2], [geom.vertices[ii[0]],
                            geom.vertices[ii[j + 1]], geom.vertices[ii[j + 2]]], 0, ii[fl] + 1));
                geom.faceVertexUvs[0].push([
                        new THREE.Vector2((Math.cos(af) + 1 + tab) / 2 / (1 + tab),
                            (Math.sin(af) + 1 + tab) / 2 / (1 + tab)),
                        new THREE.Vector2((Math.cos(aa * (j + 1) + af) + 1 + tab) / 2 / (1 + tab),
                            (Math.sin(aa * (j + 1) + af) + 1 + tab) / 2 / (1 + tab)),
                        new THREE.Vector2((Math.cos(aa * (j + 2) + af) + 1 + tab) / 2 / (1 + tab),
                            (Math.sin(aa * (j + 2) + af) + 1 + tab) / 2 / (1 + tab))]);
            }
        }
        geom.computeFaceNormals();
        geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius);
        return geom;
    }

    function chamfer_geom(vectors, faces, chamfer) {
        var chamfer_vectors = [], chamfer_faces = [], corner_faces = new Array(vectors.length);
        for (var i = 0; i < vectors.length; ++i) corner_faces[i] = [];
        for (var i = 0; i < faces.length; ++i) {
            var ii = faces[i], fl = ii.length - 1;
            var center_point = new THREE.Vector3();
            var face = new Array(fl);
            for (var j = 0; j < fl; ++j) {
                var vv = vectors[ii[j]].clone();
                center_point.add(vv);
                corner_faces[ii[j]].push(face[j] = chamfer_vectors.push(vv) - 1);
            }
            center_point.divideScalar(fl);
            for (var j = 0; j < fl; ++j) {
                var vv = chamfer_vectors[face[j]];
                vv.subVectors(vv, center_point).multiplyScalar(chamfer).addVectors(vv, center_point);
            }
            face.push(ii[fl]);
            chamfer_faces.push(face);
        }
        for (var i = 0; i < faces.length - 1; ++i) {
            for (var j = i + 1; j < faces.length; ++j) {
                var pairs = [], lastm = -1;
                for (var m = 0; m < faces[i].length - 1; ++m) {
                    var n = faces[j].indexOf(faces[i][m]);
                    if (n >= 0 && n < faces[j].length - 1) {
                        if (lastm >= 0 && m != lastm + 1) pairs.unshift([i, m], [j, n]);
                        else pairs.push([i, m], [j, n]);
                        lastm = m;
                    }
                }
                if (pairs.length != 4) continue;
                chamfer_faces.push([chamfer_faces[pairs[0][0]][pairs[0][1]],
                        chamfer_faces[pairs[1][0]][pairs[1][1]],
                        chamfer_faces[pairs[3][0]][pairs[3][1]],
                        chamfer_faces[pairs[2][0]][pairs[2][1]], -1]);
            }
        }
        for (var i = 0; i < corner_faces.length; ++i) {
            var cf = corner_faces[i], face = [cf[0]], count = cf.length - 1;
            while (count) {
                for (var m = faces.length; m < chamfer_faces.length; ++m) {
                    var index = chamfer_faces[m].indexOf(face[face.length - 1]);
                    if (index >= 0 && index < 4) {
                        if (--index == -1) index = 3;
                        var next_vertex = chamfer_faces[m][index];
                        if (cf.indexOf(next_vertex) >= 0) {
                            face.push(next_vertex);
                            break;
                        }
                    }
                }
                --count;
            }
            face.push(-1);
            chamfer_faces.push(face);
        }
        return { vectors: chamfer_vectors, faces: chamfer_faces };
    }

    function create_geom(vertices, faces, radius, tab, af, chamfer) {
        var vectors = new Array(vertices.length);
        for (var i = 0; i < vertices.length; ++i) {
            vectors[i] = (new THREE.Vector3).fromArray(vertices[i]).normalize();
        }
        var cg = chamfer_geom(vectors, faces, chamfer);
        var geom = make_geom(cg.vectors, cg.faces, radius, tab, af);
        //var geom = make_geom(vectors, faces, radius, tab, af); // Without chamfer
        geom.cannon_shape = create_shape(vectors, faces, radius);
        return geom;
    }

    function calc_texture_size(approx) {
        return Math.pow(2, Math.floor(Math.log(approx) / Math.log(2)));
    }

    function make_random_vector(vector) {
        var random_angle = rnd() * Math.PI / 5 - Math.PI / 5 / 2;
        var vec = {
            x: vector.x * Math.cos(random_angle) - vector.y * Math.sin(random_angle),
            y: vector.x * Math.sin(random_angle) + vector.y * Math.cos(random_angle)
        };
        if (vec.x == 0) vec.x = 0.01;
        if (vec.y == 0) vec.y = 0.01;
        return vec;
    }

    //determines which face is up after roll animation
    function get_dice_value(dice) {
        var vector;
        if (dice.dice_type == 'd4') {
            vector = new THREE.Vector3(0, 0, -1);
        } else {
            vector = new THREE.Vector3(0, 0, 1);
        }
        
        var closest_face, closest_angle = Math.PI * 2;
        
        if (dice.dice_type == 'd10' || dice.dice_type == 'd100') {
            // D10/D100 FIX: Use face centroid height instead of normals
            // D10 has kite-shaped faces that point outward at an angle.
            // The face whose CENTER is highest after rotation is the visible one.
            
            // Group faces by materialIndex and find centroid for each numbered group
            var faceGroups = {};
            var vertices = dice.geometry.vertices;
            
            for (var i = 0, l = dice.geometry.faces.length; i < l; ++i) {
                var face = dice.geometry.faces[i];
                if (face.materialIndex == 0) continue; // skip non-numbered faces
                
                var matIdx = face.materialIndex;
                if (!faceGroups[matIdx]) {
                    faceGroups[matIdx] = { vertices: [], count: 0 };
                }
                
                // Add vertices of this face to the group
                faceGroups[matIdx].vertices.push(vertices[face.a], vertices[face.b], vertices[face.c]);
                faceGroups[matIdx].count++;
            }
            
            // Calculate average centroid for each materialIndex group and find highest
            var best_z = -Infinity;
            var winnerMatIdx = -1;
            
            for (var matIdx in faceGroups) {
                var group = faceGroups[matIdx];
                var centroid = new THREE.Vector3(0, 0, 0);
                
                for (var j = 0; j < group.vertices.length; j++) {
                    centroid.add(group.vertices[j]);
                }
                centroid.divideScalar(group.vertices.length);
                
                // Apply dice rotation to centroid
                centroid.applyQuaternion(dice.body.quaternion);
                // Add dice position
                centroid.add(new THREE.Vector3(dice.body.position.x, dice.body.position.y, dice.body.position.z));
                
                if (centroid.z > best_z) {
                    best_z = centroid.z;
                    winnerMatIdx = parseInt(matIdx);
                }
            }
            
            // Find a face with this materialIndex for the return logic
            for (var i = 0, l = dice.geometry.faces.length; i < l; ++i) {
                if (dice.geometry.faces[i].materialIndex == winnerMatIdx) {
                    closest_face = dice.geometry.faces[i];
                    break;
                }
            }
        } else {
            // Standard algorithm for other dice (D4, D6, D8, D12, D20)
            for (var i = 0, l = dice.geometry.faces.length; i < l; ++i) {
                var face = dice.geometry.faces[i];
                if (face.materialIndex == 0) continue;
                var angle = face.normal.clone().applyQuaternion(dice.body.quaternion).angleTo(vector);
                if (angle < closest_angle) {
                    closest_angle = angle;
                    closest_face = face;
                }
            }
        }
        
        var matindex = closest_face ? closest_face.materialIndex - 1 : -1;
        if (dice.dice_type == 'd100') matindex *= 10;
        if (dice.dice_type == 'd10' && matindex == 0) matindex = 10;
        return matindex;
    }

    function get_dice_values(dices) {
        var values = [];
        for (var i = 0, l = dices.length; i < l; ++i) {
            values.push(get_dice_value(dices[i]));
        }
        return values;
    }

    function shift_dice_faces(dice, value, res) {
        var r = CONSTS.dice_face_range[dice.dice_type];
        if (dice.dice_type == 'd10' && value == 10) value = 0;
        if (!(value >= r[0] && value <= r[1])) return;
        var num = value - res;
        var geom = dice.geometry.clone();
        for (var i = 0, l = geom.faces.length; i < l; ++i) {
            var matindex = geom.faces[i].materialIndex;
            if (matindex == 0) continue;
            matindex += num - 1;
            while (matindex > r[1]) matindex -= r[1];
            while (matindex < r[0]) matindex += r[1];
            geom.faces[i].materialIndex = matindex + 1;
        }
        if (dice.dice_type == 'd4' && num != 0) {
            if (num < 0) num += 4;
            dice.material = new THREE.MeshFaceMaterial(
                    create_d4_materials(vars.scale / 2, vars.scale * 2, CONSTS.d4_labels[num]));
        }
        dice.geometry = geom;
    }
    
    function playSound(outerContainer, soundVolume) {
        // RIFT: Global sound toggle
        if (window.RIFT_DICE_SOUND === false) return;
        if (soundVolume === 0) return;
        const audio = document.createElement('audio');
        outerContainer.appendChild(audio);
        audio.src = 'assets/libs/dice/assets/nc93322.mp3'; //RIFT: adjusted path
        audio.volume = soundVolume;
        audio.play();
        audio.onended = () => {
          audio.remove();
        };
    }

    // RIFT: Create preview dice for UI
    that.createPreviewDice = function(type, scale = 0.9) {
        // Temporarily set scale for preview
        const originalScale = vars.scale;
        vars.scale = scale * 50; // Adjust for preview size
        
        let geometry, materials;
        
        switch(type) {
            case 'd4':
                geometry = create_d4_geometry(vars.scale * 1.2);
                materials = create_d4_materials(vars.scale / 2, vars.scale * 2, CONSTS.d4_labels[0]);
                break;
            case 'd6':
                geometry = create_d6_geometry(vars.scale * 1.1);
                materials = create_dice_materials(CONSTS.standart_d20_dice_face_labels, vars.scale / 2, 0.9);
                break;
            case 'd8':
                geometry = create_d8_geometry(vars.scale);
                materials = create_dice_materials(CONSTS.standart_d20_dice_face_labels, vars.scale / 2, 1.4);
                break;
            case 'd10':
                geometry = create_d10_geometry(vars.scale * 0.9);
                materials = create_dice_materials(CONSTS.standart_d20_dice_face_labels, vars.scale / 2, 1.0);
                break;
            case 'd12':
                geometry = create_d12_geometry(vars.scale * 0.9);
                materials = create_dice_materials(CONSTS.standart_d20_dice_face_labels, vars.scale / 2, 1.0);
                break;
            case 'd20':
                geometry = create_d20_geometry(vars.scale);
                materials = create_dice_materials(CONSTS.standart_d20_dice_face_labels, vars.scale / 2, 1.0);
                break;
            case 'd100':
                geometry = create_d10_geometry(vars.scale * 0.9);
                materials = create_dice_materials(CONSTS.standart_d100_dice_face_labels, vars.scale / 2, 1.5);
                break;
            default:
                vars.scale = originalScale;
                return null;
        }
        
        vars.scale = originalScale;
        
        const material = new THREE.MeshFaceMaterial(materials);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        
        return mesh;
    };
    
    // RIFT: Refresh preview dice materials (call after theme change)
    that.refreshPreviewMaterials = function() {
        // Clear cached materials so they get recreated with new colors
        threeD_dice.d4_material = null;
        threeD_dice.dice_material = null;
        threeD_dice.d100_material = null;
        threeD_dice.d6_material = null;
        threeD_dice.d8_material = null;
        threeD_dice.d10_material = null;
        threeD_dice.d12_material = null;
        threeD_dice.d20_material = null;
    };

    // RIFT: Export shift_dice_faces for remote dice
    that.shift_dice_faces = shift_dice_faces;
    that.get_dice_value = get_dice_value;

    return that;
}());

