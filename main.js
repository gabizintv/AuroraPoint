let scene, camera, renderer, world;
let playerBody, playerGroup;
let moveForward = 0, moveRight = 0;
let selectedPartId = null;
let physicsBodies = [];

const faceUrl = 'https://i.pinimg.com/736x/21/51/87/215187d5d718b5258957e8496bc1687c.jpg';

// Inicialização da Paleta
window.onload = () => {
    const palette = document.getElementById('palette-btns');
    const colors = ['#f1f10e', '#ff0000', '#0000ff', '#00aa00', '#ffffff', '#1b1b1b', '#ff5500', '#a3a2a5'];
    colors.forEach(c => {
        let d = document.createElement('div');
        d.className = 'dot';
        d.style.background = c;
        d.onclick = () => { if(selectedPartId) document.getElementById(selectedPartId).style.backgroundColor = c; };
        palette.appendChild(d);
    });
    loadAvatar();
};

// Interface
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.querySelectorAll('.main-nav a').forEach(a => a.classList.remove('active'));
    document.getElementById('content-' + tab).classList.remove('hidden');
    document.getElementById('btn-' + tab).classList.add('active');
}

function selectPart(id, name) {
    selectedPartId = id;
    document.getElementById('selected-name').innerText = name;
}

function saveAvatar() {
    let config = {};
    document.querySelectorAll('.part').forEach(p => config[p.id] = p.style.backgroundColor || '#f1f10e');
    localStorage.setItem('aurora_avatar_3d', JSON.stringify(config));
    alert("Avatar Salvo!");
}

function loadAvatar() {
    const saved = JSON.parse(localStorage.getItem('aurora_avatar_3d'));
    if(saved) Object.keys(saved).forEach(id => { if(document.getElementById(id)) document.getElementById(id).style.backgroundColor = saved[id]; });
}

// JOGO 3D
async function startGame() {
    document.getElementById('ui-wrapper').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');
    
    try {
        const elem = document.documentElement;
        if (elem.requestFullscreen) await elem.requestFullscreen();
        if (screen.orientation.lock) await screen.orientation.lock('landscape');
    } catch (e) {}

    initEngine();
}

function initEngine() {
    // FÍSICA
    world = new CANNON.World();
    world.gravity.set(0, -18, 0);

    // CENA
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-container').appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(10, 20, 10);
    scene.add(light, new THREE.AmbientLight(0xffffff, 0.4));

    // CHÃO FÍSICO
    const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x3a9d23 }));
    groundMesh.rotation.x = -Math.PI / 2;
    scene.add(groundMesh);
    const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vector3(1, 0, 0), -Math.PI / 2);
    world.addBody(groundBody);

    // PERSONAGEM
    createPlayer();

    // BLOCOS DE TESTE
    createPhysicsBox(2, 2, 2, 5, 5, -10, 0x0000ff, 5); // Pesado
    createPhysicsBox(1, 1, 1, -5, 5, -8, 0xff0000, 1); // Leve
    createPhysicsBox(1, 5, 1, 0, 2.5, -15, 0x555555, 0); // Fixo

    setupJoystick();
    animate();
}

function createPlayer() {
    playerGroup = new THREE.Group();
    const config = JSON.parse(localStorage.getItem('aurora_avatar_3d')) || {};
    const loader = new THREE.TextureLoader();
    const faceTex = loader.load(faceUrl);

    function build(w, h, d, x, y, z, color, isHead = false) {
        const mat = new THREE.MeshStandardMaterial({ color: color });
        const mesh = isHead ? new THREE.Mesh(new THREE.BoxGeometry(w,h,d), [mat,mat,mat,mat,new THREE.MeshStandardMaterial({map:faceTex}),mat]) : new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
        mesh.position.set(x, y, z);
        playerGroup.add(mesh);
    }

    build(0.6, 0.6, 0.6, 0, 0.9, 0, config['body-head'], true);
    build(1.2, 1.2, 0.6, 0, 0, 0, config['body-torso']);
    build(0.5, 1.2, 0.5, -0.9, 0, 0, config['body-larm']);
    build(0.5, 1.2, 0.5, 0.9, 0, 0, config['body-rarm']);
    build(0.5, 1.1, 0.5, -0.35, -1.15, 0, config['body-lleg']);
    build(0.5, 1.1, 0.5, 0.35, -1.15, 0, config['body-rleg']);

    scene.add(playerGroup);

    playerBody = new CANNON.Body({ mass: 1, shape: new CANNON.Box(new CANNON.Vector3(0.6, 1.2, 0.3)), fixedRotation: true });
    playerBody.position.set(0, 5, 0);
    world.addBody(playerBody);
}

function createPhysicsBox(w, h, d, x, y, z, color, mass) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color }));
    scene.add(mesh);
    const body = new CANNON.Body({ mass, shape: new CANNON.Box(new CANNON.Vector3(w/2, h/2, d/2)) });
    body.position.set(x, y, z);
    world.addBody(body);
    physicsBodies.push({ mesh, body });
}

function animate() {
    requestAnimationFrame(animate);
    world.step(1/60);

    playerGroup.position.copy(playerBody.position);
    playerGroup.position.y -= 0.5;

    if (Math.abs(moveForward) > 0.1 || Math.abs(moveRight) > 0.1) {
        playerBody.velocity.z = moveForward * 10;
        playerBody.velocity.x = moveRight * 10;
        playerGroup.rotation.y = Math.atan2(moveRight, moveForward);
    } else {
        playerBody.velocity.x = 0; playerBody.velocity.z = 0;
    }

    physicsBodies.forEach(b => { b.mesh.position.copy(b.body.position); b.mesh.quaternion.copy(b.body.quaternion); });

    camera.position.lerp(new THREE.Vector3(playerGroup.position.x, playerGroup.position.y + 7, playerGroup.position.z + 10), 0.1);
    camera.lookAt(playerGroup.position);
    renderer.render(scene, camera);
}

function setupJoystick() {
    const stick = document.getElementById('joystick-stick');
    const zone = document.getElementById('joystick-zone');
    zone.addEventListener('touchmove', e => {
        let t = e.touches[0], r = zone.getBoundingClientRect();
        let dx = t.clientX - (r.left + r.width/2), dy = t.clientY - (r.top + r.height/2);
        let dist = Math.min(Math.hypot(dx, dy), 40);
        let ang = Math.atan2(dy, dx);
        stick.style.transform = `translate(${Math.cos(ang)*dist}px, ${Math.sin(ang)*dist}px)`;
        moveForward = (Math.sin(ang)*dist)/4; moveRight = (Math.cos(ang)*dist)/4;
    });
    zone.addEventListener('touchend', () => { stick.style.transform = 'translate(0,0)'; moveForward = 0; moveRight = 0; });
}

function playerJump() { if(Math.abs(playerBody.velocity.y) < 0.1) playerBody.velocity.y = 9; }
function openExitMenu() { document.getElementById('exit-menu').classList.remove('hidden'); }
function closeExitMenu() { document.getElementById('exit-menu').classList.add('hidden'); }
function exitGame() { location.reload(); }
