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
            specular: 0x111111,
            color: 0xf0f0f0,
            shininess: 5,
            shading: THREE.FlatShading,
        },
        label_color: '#ffffff',
        // RIFT: Dynamic label color based on background brightness
        label_color_dark: '#1a1a1a',
        dice_color: '#2a2a2a', // RIFT: Dunkelgrau als Basis
        // RIFT: Gradient Support
        dice_gradient: null, // { type: 'linear'|'radial', colors: ['#color1', '#color2', ...], stops: [0, 0.5, 1] }
        ambient_light_color: 0xffffff,
        spot_light_color: 0xdddddd,
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
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.setClearColor(0xffffff, 0); //color, alpha

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
        vars.scale = Math.sqrt(this.w * this.w + this.h * this.h) / 11;
        //console.log('scale = ' + vars.scale);

        this.renderer.setSize(this.cw * 2, this.ch * 2);

        this.wh = this.ch / this.aspect / Math.tan(10 * Math.PI / 180);
        if (this.camera) this.scene.remove(this.camera);
        this.camera = new THREE.PerspectiveCamera(20, this.cw / this.ch, 1, this.wh * 1.3);
        this.camera.position.z = this.wh;

        var mw = Math.max(this.w, this.h);
        if (this.light) this.scene.remove(this.light);
        this.light = new THREE.SpotLight(vars.spot_light_color, 1.2); // RIFT: softer light
        this.light.position.set(-mw / 2, mw / 2, mw * 2);
        this.light.target.position.set(0, 0, 0);
        this.light.distance = mw * 5;
        this.light.castShadow = true;
        this.light.shadowCameraNear = mw / 10;
        this.light.shadowCameraFar = mw * 5;
        this.light.shadowCameraFov = 50;
        this.light.shadowBias = 0.001;
        this.light.shadowDarkness = 1.1;
        this.light.shadowMapWidth = 1024;
        this.light.shadowMapHeight = 1024;
        this.scene.add(this.light);

        if (this.desk) this.scene.remove(this.desk);
        this.desk = new THREE.Mesh(new THREE.PlaneGeometry(this.w * 2, this.h * 2, 1, 1), 
                new THREE.MeshPhongMaterial({ color: vars.desk_color, opacity: vars.desk_opacity, transparent: true }));
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
        var boost = (rnd() + 5) * dist * 1.5; // RIFT: More power!
        throw_dices(box, vector, boost, dist, before_roll, after_roll);
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
                z: rnd() * 300 + 350 // RIFT: Higher throw
            };
            var projector = Math.abs(vec.x / vec.y);
            if (projector > 1.0) pos.y /= projector; else pos.x *= projector;
            var velvec = make_random_vector(vector);
            var velocity = { x: velvec.x * boost * 1.3, y: velvec.y * boost * 1.3, z: -20 }; // RIFT: Faster
            var inertia = CONSTS.dice_inertia[notation.set[i]];
            var angle = {
                x: -(rnd() * vec.y * 8 + inertia * vec.y * 1.5), // RIFT: More spin
                y: rnd() * vec.x * 8 + inertia * vec.x * 1.5,
                z: rnd() * 3 // RIFT: Add z-rotation
            };
            var axis = { x: rnd(), y: rnd(), z: rnd(), a: rnd() };
            vectors.push({ set: notation.set[i], pos: pos, velocity: velocity, angle: angle, axis: axis });
        }
        return vectors;
    }

    that.dice_box.prototype.create_dice = function(type, pos, velocity, angle, axis) {
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
        this.renderer.render(this.scene, this.camera);
        this.last_time = this.last_time ? time : (new Date()).getTime();
        if (this.running == threadid && this.check_if_throw_finished()) {
            this.running = false;
            if (this.callback) this.callback.call(this, get_dice_values(this.dices));
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

    that.dice_box.prototype.clear = function() {
        this.running = false;
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
        if (!this.dice_material) this.dice_material = new THREE.MeshFaceMaterial(
                create_dice_materials(CONSTS.standart_d20_dice_face_labels, vars.scale / 2, 0.9));
        return new THREE.Mesh(this.d6_geometry, this.dice_material);
    }

    threeD_dice.create_d8 = function() {
        if (!this.d8_geometry) this.d8_geometry = create_d8_geometry(vars.scale);
        if (!this.dice_material) this.dice_material = new THREE.MeshFaceMaterial(
                create_dice_materials(CONSTS.standart_d20_dice_face_labels, vars.scale / 2, 1.4));
        return new THREE.Mesh(this.d8_geometry, this.dice_material);
    }

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
        // RIFT: Reduced margin from 1.2 to 1.0 for more uniform look
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
    
    // RIFT: Methode um Würfelfarbe zu ändern
    that.setDiceColor = function(color, gradient) {
        vars.dice_color = color;
        vars.dice_gradient = gradient || null;
        
        // RIFT: Nur automatisch Label-Farbe wählen wenn KEINE manuelle Farbe gesetzt ist
        if (!manualLabelColor) {
            var brightness = getColorBrightness(gradient ? gradient.colors[0] : color);
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
            var brightness = getColorBrightness(vars.dice_gradient ? vars.dice_gradient.colors[0] : vars.dice_color);
            vars.label_color = brightness > 160 ? vars.label_color_dark : '#ffffff';
        } else {
            // Manuelle Farbe setzen
            manualLabelColor = color;
            vars.label_color = color;
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
    
    // RIFT: Getter für aktuelle Label-Farbe
    that.getLabelColor = function() {
        return manualLabelColor || vars.label_color;
    };
    
    // RIFT: Prüfen ob Label-Farbe manuell ist
    that.isLabelColorManual = function() {
        return manualLabelColor !== null;
    };
    
    // RIFT: Berechne Helligkeit einer Farbe (0-255)
    function getColorBrightness(hexColor) {
        if (!hexColor) return 0;
        var hex = hexColor.replace('#', '');
        if (hex.length === 3) {
            hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        }
        var r = parseInt(hex.substr(0, 2), 16);
        var g = parseInt(hex.substr(2, 2), 16);
        var b = parseInt(hex.substr(4, 2), 16);
        // Perceived brightness formula
        return (r * 299 + g * 587 + b * 114) / 1000;
    }
    
    // RIFT: Gradient-Helper Funktion
    function fillWithGradient(context, width, height, gradient) {
        if (!gradient || !gradient.colors || gradient.colors.length < 2) {
            return false;
        }
        
        var grd;
        if (gradient.type === 'radial') {
            // Radial gradient from center - light source effect
            var cx = width / 2;
            var cy = height / 2;
            var radius = Math.max(width, height) * 0.7;
            grd = context.createRadialGradient(cx * 0.6, cy * 0.6, 0, cx, cy, radius);
        } else {
            // Linear gradient - more subtle, from top-left to center-ish
            grd = context.createLinearGradient(0, 0, width * 0.7, height * 0.7);
        }
        
        var stops = gradient.stops || gradient.colors.map((_, i, arr) => i / (arr.length - 1));
        gradient.colors.forEach((color, i) => {
            grd.addColorStop(stops[i] || i / (gradient.colors.length - 1), color);
        });
        
        context.fillStyle = grd;
        context.fillRect(0, 0, width, height);
        
        // RIFT: Apply texture overlay if specified
        if (gradient.texture) {
            applyTexture(context, width, height, gradient.texture, gradient.colors);
        }
        
        return true;
    }
    
    // RIFT: Texture overlay system - BALANCED VISIBILITY
    function applyTexture(context, width, height, texture, colors) {
        context.save();
        
        switch(texture) {
            case 'stripes':
                context.globalCompositeOperation = 'overlay';
                context.strokeStyle = 'rgba(255,255,255,0.25)';
                context.lineWidth = width / 15;
                for (var i = -height; i < width + height; i += width / 8) {
                    context.beginPath();
                    context.moveTo(i, 0);
                    context.lineTo(i + height, height);
                    context.stroke();
                }
                break;
                
            case 'dots':
                context.globalCompositeOperation = 'overlay';
                var dotSize = width / 25;
                var spacing = width / 10;
                for (var x = spacing/2; x < width; x += spacing) {
                    for (var y = spacing/2; y < height; y += spacing) {
                        context.fillStyle = 'rgba(255,255,255,0.3)';
                        context.beginPath();
                        context.arc(x, y, dotSize, 0, Math.PI * 2);
                        context.fill();
                    }
                }
                break;
                
            case 'noise':
                var imageData = context.getImageData(0, 0, width, height);
                var data = imageData.data;
                for (var i = 0; i < data.length; i += 4) {
                    var noise = (Math.random() - 0.5) * 45;
                    data[i] = Math.min(255, Math.max(0, data[i] + noise));
                    data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise));
                    data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise));
                }
                context.putImageData(imageData, 0, 0);
                break;
                
            case 'marble':
                for (var v = 0; v < 12; v++) {
                    context.globalCompositeOperation = 'overlay';
                    context.strokeStyle = v % 2 === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
                    context.lineWidth = 1 + Math.random() * 3;
                    context.beginPath();
                    var startX = Math.random() * width;
                    var startY = Math.random() * height;
                    context.moveTo(startX, startY);
                    for (var j = 0; j < 6; j++) {
                        var cpX = startX + (Math.random() - 0.5) * width * 0.5;
                        var cpY = startY + (Math.random() - 0.5) * height * 0.5;
                        var endX = startX + (Math.random() - 0.5) * width * 0.7;
                        var endY = startY + (Math.random() - 0.5) * height * 0.7;
                        context.quadraticCurveTo(cpX, cpY, endX, endY);
                        startX = endX; startY = endY;
                    }
                    context.stroke();
                }
                break;
                
            case 'sparkle':
                context.globalCompositeOperation = 'screen';
                for (var i = 0; i < 45; i++) {
                    var x = Math.random() * width;
                    var y = Math.random() * height;
                    var size = Math.random() * 4 + 1.5;
                    var alpha = Math.random() * 0.7 + 0.2;
                    context.fillStyle = 'rgba(255,255,255,' + alpha + ')';
                    context.beginPath();
                    context.moveTo(x, y - size);
                    context.lineTo(x + size * 0.25, y - size * 0.25);
                    context.lineTo(x + size, y);
                    context.lineTo(x + size * 0.25, y + size * 0.25);
                    context.lineTo(x, y + size);
                    context.lineTo(x - size * 0.25, y + size * 0.25);
                    context.lineTo(x - size, y);
                    context.lineTo(x - size * 0.25, y - size * 0.25);
                    context.closePath();
                    context.fill();
                }
                break;
                
            case 'checker':
                context.globalCompositeOperation = 'overlay';
                var checkSize = width / 7;
                for (var x = 0; x < width; x += checkSize) {
                    for (var y = 0; y < height; y += checkSize) {
                        if ((Math.floor(x/checkSize) + Math.floor(y/checkSize)) % 2 === 0) {
                            context.fillStyle = 'rgba(0,0,0,0.2)';
                        } else {
                            context.fillStyle = 'rgba(255,255,255,0.1)';
                        }
                        context.fillRect(x, y, checkSize, checkSize);
                    }
                }
                break;
                
            case 'waves':
                context.globalCompositeOperation = 'overlay';
                context.strokeStyle = 'rgba(255,255,255,0.2)';
                context.lineWidth = 3;
                for (var i = 0; i < height * 1.5; i += width / 12) {
                    context.beginPath();
                    for (var x = 0; x < width; x += 4) {
                        var y = i + Math.sin(x * 0.035) * (width / 15);
                        if (x === 0) context.moveTo(x, y);
                        else context.lineTo(x, y);
                    }
                    context.stroke();
                }
                break;
                
            case 'camo':
                context.globalCompositeOperation = 'overlay';
                var camoColors = ['rgba(0,0,0,0.25)', 'rgba(255,255,255,0.15)', 'rgba(0,0,0,0.15)'];
                for (var i = 0; i < 15; i++) {
                    context.fillStyle = camoColors[i % camoColors.length];
                    context.beginPath();
                    var cx = Math.random() * width;
                    var cy = Math.random() * height;
                    context.moveTo(cx, cy);
                    for (var j = 0; j < 6; j++) {
                        var angle = (j / 6) * Math.PI * 2;
                        var radius = width * 0.1 + Math.random() * width * 0.15;
                        context.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
                    }
                    context.closePath();
                    context.fill();
                }
                break;
                
            case 'wood':
                context.globalCompositeOperation = 'overlay';
                for (var i = 0; i < width; i += 4 + Math.random() * 5) {
                    context.strokeStyle = 'rgba(0,0,0,' + (0.1 + Math.random() * 0.15) + ')';
                    context.lineWidth = 1 + Math.random() * 1.5;
                    context.beginPath();
                    context.moveTo(i, 0);
                    var x = i;
                    for (var y = 0; y < height; y += 8) {
                        x += (Math.random() - 0.5) * 4;
                        context.lineTo(x, y);
                    }
                    context.stroke();
                }
                break;
                
            case 'starfield':
                context.globalCompositeOperation = 'screen';
                for (var i = 0; i < 60; i++) {
                    var x = Math.random() * width;
                    var y = Math.random() * height;
                    var size = Math.random() * 2.5 + 0.5;
                    var alpha = Math.random() * 0.8 + 0.2;
                    context.fillStyle = 'rgba(255,255,255,' + alpha + ')';
                    context.beginPath();
                    context.arc(x, y, size, 0, Math.PI * 2);
                    context.fill();
                }
                break;
                
            case 'lightning':
                context.globalCompositeOperation = 'screen';
                context.strokeStyle = 'rgba(255,255,255,0.7)';
                context.lineWidth = 2;
                context.shadowColor = '#ffffff';
                context.shadowBlur = 8;
                for (var bolt = 0; bolt < 2; bolt++) {
                    context.beginPath();
                    var x = width * 0.25 + Math.random() * width * 0.5;
                    var y = 0;
                    context.moveTo(x, y);
                    while (y < height) {
                        x += (Math.random() - 0.5) * 40;
                        y += 10 + Math.random() * 18;
                        context.lineTo(x, y);
                    }
                    context.stroke();
                }
                context.shadowBlur = 0;
                break;
                
            case 'hexagon':
                context.globalCompositeOperation = 'overlay';
                context.strokeStyle = 'rgba(255,255,255,0.25)';
                context.lineWidth = 1.5;
                var hexSize = width / 9;
                var hexHeight = hexSize * Math.sqrt(3);
                for (var row = -1; row < height / hexHeight + 1; row++) {
                    for (var col = -1; col < width / (hexSize * 1.5) + 1; col++) {
                        var cx = col * hexSize * 1.5;
                        var cy = row * hexHeight + (col % 2) * hexHeight / 2;
                        context.beginPath();
                        for (var i = 0; i < 6; i++) {
                            var angle = (i / 6) * Math.PI * 2 - Math.PI / 6;
                            var hx = cx + Math.cos(angle) * hexSize * 0.48;
                            var hy = cy + Math.sin(angle) * hexSize * 0.48;
                            if (i === 0) context.moveTo(hx, hy);
                            else context.lineTo(hx, hy);
                        }
                        context.closePath();
                        context.stroke();
                    }
                }
                break;
                
            case 'scales':
                context.globalCompositeOperation = 'overlay';
                var scaleSize = width / 10;
                for (var row = 0; row < height / scaleSize + 2; row++) {
                    for (var col = -1; col < width / scaleSize + 2; col++) {
                        var cx = col * scaleSize + (row % 2) * scaleSize / 2;
                        var cy = row * scaleSize * 0.65;
                        context.fillStyle = 'rgba(255,255,255,0.12)';
                        context.beginPath();
                        context.arc(cx, cy, scaleSize * 0.55, 0, Math.PI);
                        context.fill();
                        context.strokeStyle = 'rgba(0,0,0,0.15)';
                        context.lineWidth = 1;
                        context.stroke();
                    }
                }
                break;
        }
        
        context.restore();
    }
    
    function create_dice_materials(face_labels, size, margin) {
        function create_text_texture(text, color, back_color) {
            if (text == undefined) return null;
            var canvas = document.createElement("canvas");
            var context = canvas.getContext("2d");
            var ts = calc_texture_size(size + size * 2 * margin) * 2;
            canvas.width = canvas.height = ts;
            context.font = ts / (1 + 2 * margin) + "pt Arial";
            
            // RIFT: Try gradient first, fallback to solid color
            if (!fillWithGradient(context, canvas.width, canvas.height, vars.dice_gradient)) {
                context.fillStyle = back_color;
                context.fillRect(0, 0, canvas.width, canvas.height);
            }
            
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillStyle = color;
            context.fillText(text, canvas.width / 2, canvas.height / 2);
            if (text == '6' || text == '9') {
                context.fillText('  .', canvas.width / 2, canvas.height / 2);
            }
            var texture = new THREE.Texture(canvas);
            texture.needsUpdate = true;
            return texture;
        }
        var materials = [];
        for (var i = 0; i < face_labels.length; ++i)
            materials.push(new THREE.MeshPhongMaterial($t.copyto(vars.material_options,
                        { map: create_text_texture(face_labels[i], vars.label_color, vars.dice_color) })));
        return materials;
    }

    function create_d4_materials(size, margin, labels) {
        function create_d4_text(text, color, back_color) {
            var canvas = document.createElement("canvas");
            var context = canvas.getContext("2d");
            var ts = calc_texture_size(size + margin) * 2;
            canvas.width = canvas.height = ts;
            context.font = (ts - margin) * 0.5 + "pt Arial";
            
            // RIFT: Try gradient first, fallback to solid color
            if (!fillWithGradient(context, canvas.width, canvas.height, vars.dice_gradient)) {
                context.fillStyle = back_color;
                context.fillRect(0, 0, canvas.width, canvas.height);
            }
            
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillStyle = color;
            for (var i in text) {
                context.fillText(text[i], canvas.width / 2,
                        canvas.height / 2 - ts * 0.3);
                context.translate(canvas.width / 2, canvas.height / 2);
                context.rotate(Math.PI * 2 / 3);
                context.translate(-canvas.width / 2, -canvas.height / 2);
            }
            var texture = new THREE.Texture(canvas);
            texture.needsUpdate = true;
            return texture;
        }
        var materials = [];
        for (var i = 0; i < labels.length; ++i)
            materials.push(new THREE.MeshPhongMaterial($t.copyto(vars.material_options,
                        { map: create_d4_text(labels[i], vars.label_color, vars.dice_color) })));
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
        // Correct Pentagonal Trapezohedron geometry - NO CHAMFER
        // A real d10 has ONLY 10 kite-shaped faces with sharp edges
        
        var a = Math.PI * 2 / 5;  // 72° between vertices in each ring
        
        // Proportions for a proper d10
        var h_apex = 0.95;        // Height of apex points
        var h_ring = 0.25;        // Height of middle rings from center
        var r_ring = 0.85;        // Radius of middle rings
        
        var vertices = [];
        
        // Vertex 0: Top apex
        vertices.push([0, 0, h_apex]);
        
        // Vertices 1-5: Upper ring (at +h_ring)
        for (var i = 0; i < 5; i++) {
            vertices.push([
                r_ring * Math.cos(a * i),
                r_ring * Math.sin(a * i),
                h_ring
            ]);
        }
        
        // Vertices 6-10: Lower ring (at -h_ring), offset by 36°
        for (var i = 0; i < 5; i++) {
            vertices.push([
                r_ring * Math.cos(a * i + a / 2),
                r_ring * Math.sin(a * i + a / 2),
                -h_ring
            ]);
        }
        
        // Vertex 11: Bottom apex
        vertices.push([0, 0, -h_apex]);
        
        // 10 kite-shaped faces
        var faces = [
            // Upper 5 kites (touching top apex)
            [0, 2, 6, 1, 0],
            [0, 3, 7, 2, 2],
            [0, 4, 8, 3, 4],
            [0, 5, 9, 4, 6],
            [0, 1, 10, 5, 8],
            
            // Lower 5 kites (touching bottom apex)
            [11, 6, 2, 7, 1],
            [11, 7, 3, 8, 3],
            [11, 8, 4, 9, 5],
            [11, 9, 5, 10, 7],
            [11, 10, 1, 6, 9]
        ];
        
        // Create geometry WITHOUT chamfer (sharp edges like a real d10)
        return create_geom_no_chamfer(vertices, faces, radius, 0, Math.PI / 5);
    }
    
    // Special geometry creator without chamfer edges
    function create_geom_no_chamfer(vertices, faces, radius, tab, af) {
        var vectors = new Array(vertices.length);
        for (var i = 0; i < vertices.length; ++i) {
            vectors[i] = (new THREE.Vector3).fromArray(vertices[i]).normalize();
        }
        // Use original vertices/faces directly - no chamfer_geom call!
        var geom = make_geom(vectors, faces, radius, tab, af);
        geom.cannon_shape = create_shape(vectors, faces, radius);
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
            var debugInfo = [];
            
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
                
                debugInfo.push({
                    matIdx: parseInt(matIdx),
                    z: centroid.z.toFixed(3)
                });
                
                if (centroid.z > best_z) {
                    best_z = centroid.z;
                    winnerMatIdx = parseInt(matIdx);
                }
            }
            
            // Debug output - show the actual displayed number for each materialIndex
            // materialIndex 1 = "0", 2 = "1", 3 = "2", etc.
            var debugWithNumbers = debugInfo.map(function(d) {
                var displayNum = d.matIdx - 1; // matIdx 1 -> 0, matIdx 2 -> 1, etc.
                return { matIdx: d.matIdx, displayNum: displayNum, z: d.z };
            });
            console.log('[D10 Debug] Face centroids (sorted by Z):', debugWithNumbers.sort((a,b) => b.z - a.z).slice(0, 5));
            
            var winnerDisplayNum = winnerMatIdx - 1;
            console.log('[D10 Debug] Winner: matIdx=' + winnerMatIdx + ', displays="' + winnerDisplayNum + '", z=' + best_z.toFixed(3));
            
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
    
    //playSound function and audio file copied from 
    //https://github.com/chukwumaijem/roll-a-die
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
    
    // RIFT: Create a preview dice mesh (fresh, not cached) for card previews
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

