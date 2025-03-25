class VisualizationManager {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.points = [];
        this.scatterLines = [];
        this.currentData = null;
        this.animationFrameId = null;
        this.lastFrameTime = 0;
        this.firstVisualization = true;
        this.debug = false;
        
        // Initialize overlay state
        this.isOverlayVisible = true;
        
        // Show initial message
        this.showOverlay('Select documents with vector databases to visualize');
        
        // Add initialization state tracking
        this.initialized = false;
        this.initializationError = null;

        // Initialize with more robust error handling
        try {
            this.initialize((success) => {
                this.initialized = success;
                if (success) {
                    console.log('Visualization successfully initialized');
                    // Force initial update after a short delay
                    setTimeout(() => {
                        this.redrawScene();
                    }, 100);
                } else {
                    console.error('Visualization initialization failed');
                    this.showOverlay('Error initializing visualization', 'error');
                }
            });
        } catch (error) {
            console.error('Error in visualization constructor:', error);
            this.initializationError = error;
            this.showOverlay('Error initializing visualization: ' + error.message, 'error');
        }

        this.queryAnimationManager = new QueryAnimationManager();

        // Setup socket event handlers
        this.setupSocketHandlers();
    }

    setupSocketHandlers() {
        const socket = io();
        
        // Listen for retrieved nodes events
        socket.on('nodes_retrieved', (data) => {
            console.log('Nodes retrieved:', data);
            if (data.node_ids && data.node_ids.length > 0) {
                // Start animation immediately when nodes are found
                this.queryAnimationManager.handleRetrievedNodes(data.node_ids, this.scene);
            }
        });

        // Listen for chat response completion
        socket.on('chat_response_complete', () => {
            console.log('Chat response complete, triggering decay');
            this.queryAnimationManager.handleResponseComplete();
        });
    }

    initialize(callback) {
        try {
            if (typeof THREE === 'undefined') {
                throw new Error('THREE is not loaded');
            }

            // Initialize Three.js scene
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x000000);

            const canvas = document.getElementById('canvas');
            const container = document.querySelector('#visualization');
            
            // Make canvas resolution match display resolution
            const pixelRatio = window.devicePixelRatio || 1;
            canvas.width = container.clientWidth * pixelRatio;
            canvas.height = container.clientHeight * pixelRatio;
            canvas.style.width = `${container.clientWidth}px`;
            canvas.style.height = `${container.clientHeight}px`;

            // Initialize camera, renderer, controls
            this.setupCamera(canvas);
            this.setupRenderer(canvas);
            this.setupControls();

            // Add lighting
            const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
            this.scene.add(ambientLight);

            // Add immediate render call
            if (this.scene && this.camera && this.renderer) {
                this.renderer.render(this.scene, this.camera);
            }

            // Start animation loop
            this.animate();
            this.handleResize();

            // Add event listeners
            this.initializeEventListeners();
            
            console.log('Visualization manager initialized');

            // Call callback when done
            if (callback) callback(true);
        } catch (error) {
            console.error('Error initializing visualization:', error);
            this.showOverlay('Error initializing 3D visualization', 'error');
            if (callback) callback(false);
        }
    }

    setupCamera(canvas) {
        this.camera = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, 1000);
        const initialDistance = 15;
        this.camera.position.set(initialDistance, initialDistance, initialDistance);
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(0, 0, 0);
        
        // Force matrix updates
        this.camera.updateMatrix();
        this.camera.updateMatrixWorld();
        this.camera.updateProjectionMatrix();
    }

    setupRenderer(canvas) {
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true
        });
        // Critical fix: Set both renderer size and viewport size
        this.renderer.setSize(canvas.width, canvas.height);
        this.renderer.setPixelRatio(window.devicePixelRatio || 1);
        // Add this line to ensure proper viewport dimensions
        this.renderer.setViewport(0, 0, canvas.width, canvas.height);
        // Add immediate render call to ensure scene is visible
        if (this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    setupControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true;
        this.controls.target.set(0, 0, 0);
        this.controls.minDistance = 2;
        this.controls.maxDistance = 50;
        this.controls.update();
    }

    initializeEventListeners() {
        window.addEventListener('resize', () => this.handleResize());
        
        // Simplify and fix settings change handler
        const settingsIds = [
            'colorMode', 'scaleMin', 'scaleMax', 'curveMin', 'curveMax', 
            'speedMin', 'speedMax', 'sizeMin', 'sizeMax', 'undulationsMin', 
            'undulationsMax', 'amplitudeMin', 'amplitudeMax', 'phaseMin', 
            'phaseMax', 'scatterFreqMin', 'scatterFreqMax', 'scatterLengthMin', 
            'scatterLengthMax', 'scatterVelocity', 'scatterLife'
        ];

        settingsIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                ['change', 'input'].forEach(eventType => {
                    element.addEventListener(eventType, () => {
                        // Force a complete refresh instead of just updating the point cloud
                        if (this.initialized) {
                            console.log(`Setting ${id} changed, triggering full visualization update`);
                            this.redrawScene();  // Call full update instead of redrawYarn
                        }
                    });
                });
            }
        });

        // Add zoom extents button handler
        const zoomExtendsBtn = document.getElementById('zoomExtents');
        if (zoomExtendsBtn) {
            zoomExtendsBtn.addEventListener('click', () => {
                console.log('Zoom extents clicked');
                this.zoomExtents();
            });
        }
    }

    animate() {
        const currentTime = performance.now() / 1000;
        const deltaTime = this.lastFrameTime === 0 ? 0 : currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;
        
        this.animationFrameId = requestAnimationFrame(() => this.animate());

        // Update points and scatter lines
        if (this.points.length > 0) {
            this.updatePoints(currentTime, deltaTime);
        }
        this.updateScatterLines(deltaTime);
        
        // Update controls and render
        if (this.controls) this.controls.update();
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    updatePoints(currentTime, deltaTime) {
        if (this.points.length > 0) {
            // Convert to milliseconds for query animations
            const timeMs = currentTime * 1000;
            
            this.points[0].children.forEach(child => {
                if (child instanceof THREE.Mesh && child.userData?.curve) {
                    try {
                        if (typeof child.userData.progress !== 'number') {
                            child.userData.progress = 0;
                        }
                        
                        let velocity = child.userData.velocity;
                        if (typeof velocity !== 'number') {
                            velocity = 0;
                            child.userData.velocity = 0;
                        }
                        
                        let progress = child.userData.progress + velocity;
                        
                        if (progress > 1) {
                            progress = progress - Math.floor(progress);
                        } else if (progress < 0) {
                            progress = 1 + (progress % 1);
                        }
                        
                        progress = Math.max(0, Math.min(1, progress));
                        child.userData.progress = progress;
                        
                        try {
                            const position = child.userData.curve.getPointAt(progress);
                            if (position && position.isVector3) {
                                child.position.copy(position);
                                
                                // Make point always face camera
                                if (this.camera) {
                                    child.lookAt(this.camera.position);
                                }
                            } else {
                                console.warn('Invalid position returned from curve');
                            }
                        } catch (e) {
                            console.warn(`Error updating point position: ${e.message}`);
                        }

                        // Handle scatter effect
                        if (child.userData.scatterFrequency !== undefined) {
                            const scatterInterval = this.getScatterInterval(child.userData.scatterFrequency);
                            if (child.userData.nextScatterTime === undefined) {
                                child.userData.nextScatterTime = currentTime + scatterInterval;
                            }

                            if (currentTime >= child.userData.nextScatterTime) {
                                this.createScatterLine(child);
                                child.userData.nextScatterTime = currentTime + scatterInterval;
                            }
                        }

                        // Apply query animation to both point and ring
                        if (child.userData?.nodeId) {
                            // Find the associated ring
                            const ring = this.points[0].children.find(obj => 
                                obj instanceof THREE.Line && 
                                obj.userData?.nodeId === child.userData.nodeId
                            );
                            
                            // Update animations with proper timing
                            if (ring) {
                                const ringUpdated = this.queryAnimationManager.updateAnimation(ring, timeMs);
                                if (ringUpdated) {
                                    ring.material.needsUpdate = true;
                                }
                            }
                            
                            const pointUpdated = this.queryAnimationManager.updateAnimation(child, timeMs);
                            if (pointUpdated) {
                                child.material.needsUpdate = true;
                            }
                        }
                    } catch (error) {
                        console.warn('Animation error:', error);
                    }
                }
            });
        }
    }

    updateScatterLines(deltaTime) {
        const linesToRemove = [];
        
        this.scatterLines.forEach((line, index) => {
            if (!line.userData) return;
            
            try {
                line.userData.age += deltaTime;
                const remainingLife = Math.max(0, 1 - line.userData.age / line.userData.lifetime);
                line.material.opacity = remainingLife;
                
                if (line.userData.age >= line.userData.lifetime) {
                    linesToRemove.push(index);
                    return;
                }
                
                const speed = line.userData.velocity * deltaTime;
                const direction = line.userData.velocity >= 0 ? 
                    new THREE.Vector3().subVectors(line.userData.endPoint, line.userData.startPoint).normalize() :
                    new THREE.Vector3().subVectors(line.userData.startPoint, line.userData.endPoint).normalize();
                
                line.userData.startPoint.add(direction.clone().multiplyScalar(speed));
                line.userData.endPoint.add(direction.clone().multiplyScalar(speed));
                
                const positions = line.geometry.attributes.position.array;
                positions[0] = line.userData.startPoint.x;
                positions[1] = line.userData.startPoint.y;
                positions[2] = line.userData.startPoint.z;
                positions[3] = line.userData.endPoint.x;
                positions[4] = line.userData.endPoint.y;
                positions[5] = line.userData.endPoint.z;
                line.geometry.attributes.position.needsUpdate = true;
                
            } catch (error) {
                console.warn('Error updating scatter line:', error);
                linesToRemove.push(index);
            }
        });
        
        for (let i = linesToRemove.length - 1; i >= 0; i--) {
            const index = linesToRemove[i];
            const line = this.scatterLines[index];
            this.scene.remove(line);
            line.geometry.dispose();
            line.material.dispose();
            this.scatterLines.splice(index, 1);
        }
    }

    getScatterInterval(normalizedFrequency) {
        const freqMin = parseFloat(document.getElementById('scatterFreqMin').value) || 0.1;
        const freqMax = parseFloat(document.getElementById('scatterFreqMax').value) || 1.0;
        const frequency = freqMin + ((normalizedFrequency + 1) / 2) * (freqMax - freqMin);
        return 1 / Math.max(0.01, frequency);
    }

    createScatterLine(pointMesh) {
        const scatterLengthMin = parseFloat(document.getElementById('scatterLengthMin').value) || 0.1;
        const scatterLengthMax = parseFloat(document.getElementById('scatterLengthMax').value) || 1.0;
        const scatterVelocity = parseFloat(document.getElementById('scatterVelocity').value) || 0.1;
        const scatterLife = parseFloat(document.getElementById('scatterLife').value) || 1.0;

        // Calculate direction relative to origin (0,0,0)
        const origin = new THREE.Vector3(0, 0, 0);
        const pointPosition = pointMesh.position.clone();
        let directionToOrigin = new THREE.Vector3().subVectors(origin, pointPosition).normalize();
        
        // Use scatter length value to determine if line goes toward or away from origin
        // scatterLength is normalized to [-1, 1], negative means away from origin
        const scatterLengthValue = pointMesh.userData.scatterLength;
        if (scatterLengthValue < 0) {
            directionToOrigin.negate(); // Point away from origin
        }

        // Calculate actual scatter length
        const scatterLength = scatterLengthMin + ((Math.abs(scatterLengthValue) + 1) / 2) * (scatterLengthMax - scatterLengthMin);
        
        // Create start and end points
        const scatterStart = pointPosition.clone();
        const scatterEnd = pointPosition.clone().add(directionToOrigin.multiplyScalar(scatterLength));

        // Create the scatter line geometry
        const scatterGeometry = new THREE.BufferGeometry().setFromPoints([scatterStart, scatterEnd]);
        
        // Calculate color based on scatter color dimension (dimension 11)
        let scatterColor;
        const colorValue = pointMesh.userData.scatterColor || 0;
        if (colorValue < -0.33) {
            const t = (colorValue + 1) / 0.67;
            scatterColor = new THREE.Color(0, t, 1);
        } else if (colorValue < 0.33) {
            const t = (colorValue + 0.33) / 0.66;
            scatterColor = new THREE.Color(t, 1, 1 - t);
        } else {
            const t = (colorValue - 0.33) / 0.67;
            scatterColor = new THREE.Color(1, 1 - t, 0);
        }

        const scatterMaterial = new THREE.LineBasicMaterial({ 
            color: scatterColor,
            transparent: true, 
            opacity: 1.0 
        });

        const scatterLine = new THREE.Line(scatterGeometry, scatterMaterial);
        
        scatterLine.userData = {
            startPoint: scatterStart,
            endPoint: scatterEnd,
            velocity: scatterVelocity,
            lifetime: scatterLife,
            age: 0
        };

        this.scene.add(scatterLine);
        this.scatterLines.push(scatterLine);
    }

    updateColors(pointsData, metadata) {
        const colorMode = document.getElementById('colorMode').value;
        const colors = new Float32Array(pointsData.length * 3);
        
        if (colorMode === 'database') {
            const uniqueDbs = [...new Set(metadata.map(m => m.database))];
            metadata.forEach((meta, i) => {
                const t = uniqueDbs.indexOf(meta.database) / Math.max(1, uniqueDbs.length - 1);
                const color = new THREE.Color().setHSL(t, 0.7, 0.5);
                colors[i * 3] = color.r;
                colors[i * 3 + 1] = color.g;
                colors[i * 3 + 2] = color.b;
            });
        } else if (colorMode === 'dimension') {
            const values = pointsData.map(p => p[0]);
            const min = Math.min(...values);
            const max = Math.max(...values);
            pointsData.forEach((point, i) => {
                const t = (point[0] - min) / (max - min);
                const color = new THREE.Color().setHSL(0.7 - 0.7 * t, 0.85, 0.5);
                colors[i * 3] = color.r;
                colors[i * 3 + 1] = color.g;
                colors[i * 3 + 2] = color.b;
            });
        } else if (colorMode === 'rgb') {
            pointsData.forEach((point, i) => {
                const colorValue = point[5] || 0;  //color of the ring according to dimension 6 [5]
                let r, g, b;
                
                if (colorValue < -0.33) {
                    const t = (colorValue + 1) / 0.67;
                    r = 0;
                    g = t;
                    b = 1;
                } else if (colorValue < 0.33) {
                    const t = (colorValue + 0.33) / 0.66;
                    r = t;
                    g = 1;
                    b = 1 - t;
                } else {
                    const t = (colorValue - 0.33) / 0.67;
                    r = 0,98;
                    g = 1 - t;
                    b = 0;
                }
                
                colors[i * 3] = r;
                colors[i * 3 + 1] = g;
                colors[i * 3 + 2] = b;
            });
        }
        return colors;
    }

    createSemanticYarn(pointsData, colors, metadata) {
        console.log('Creating semantic yarn with:', {
            points: pointsData?.length,
            colors: colors?.length,
            metadata: metadata?.length
        });

        const group = new THREE.Group();
        const baseRadius = 2;
        const numPoints = 100;

        // Get all settings first and log them
        const settings = {
            scaleMin: parseFloat(document.getElementById('scaleMin').value) || 0.6,
            scaleMax: parseFloat(document.getElementById('scaleMax').value) || 1.5,
            curveMin: parseFloat(document.getElementById('curveMin').value) || -1.0,
            curveMax: parseFloat(document.getElementById('curveMax').value) || 1.0,
            speedMin: parseFloat(document.getElementById('speedMin').value) || -0.02,
            speedMax: parseFloat(document.getElementById('speedMax').value) || 0.02,
            sizeMin: parseFloat(document.getElementById('sizeMin').value) || 0.1,
            sizeMax: parseFloat(document.getElementById('sizeMax').value) || 0.3
        };

        console.log('Using visualization settings:', settings);

        // Find min/max values for normalization
        const dimensions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        const ranges = dimensions.map(dim => {
            const values = pointsData.map(p => {
                const val = p[dim];
                return typeof val === 'number' ? val : 0;
            });
            const min = Math.min(...values);
            const max = Math.max(...values);
            return {
                min: min === max ? min - 1 : min,
                max: min === max ? max + 1 : max
            };
        });

        pointsData.forEach((point, i) => {
            try {
                // Log raw value for velocity dimension
                console.log(`Point ${i}: raw velocity dimension value=${point[3]}`);
                
                // Normalize dimensions, using 0 for missing ones
                const normalizedPoint = dimensions.map(dim => {
                    const val = point[dim] || 0;
                    const range = ranges[dim];
                    return -1 + 2 * (val - range.min) / (range.max - range.min);
                });

                const rotationX = (normalizedPoint[0] * Math.PI) / 2;
                const rotationZ = (normalizedPoint[1] * Math.PI) / 2;
                const scale = settings.scaleMin + ((normalizedPoint[2] + 1) / 2) * (settings.scaleMax - settings.scaleMin);
                
                // Velocity calculation: map normalized values to speed range
                let velocity;
                if (normalizedPoint[3] > 0) {
                    velocity = normalizedPoint[3] * settings.speedMax;
                } else if (normalizedPoint[3] < 0) {
                    velocity = normalizedPoint[3] * Math.abs(settings.speedMin);
                } else {
                    velocity = 0;
                }
                
                console.log(`Point ${i}: normalized=${normalizedPoint[3]}, velocity=${velocity}`);
                
                const pointSize = settings.sizeMin + ((normalizedPoint[4] + 1) / 2) * (settings.sizeMax - settings.sizeMin);
                
                // Calculate undulations based on dimension 6
                const undulationsMin = parseFloat(document.getElementById('undulationsMin').value) || 2;
                const undulationsMax = parseFloat(document.getElementById('undulationsMax').value) || 10;
                const undulations = Math.round(undulationsMin + ((normalizedPoint[6] + 1) / 2) * (undulationsMax - undulationsMin));
                
                // Calculate wave amplitude from dimension 7
                const amplitudeMin = parseFloat(document.getElementById('amplitudeMin').value) || 0.05;
                const amplitudeMax = parseFloat(document.getElementById('amplitudeMax').value) || 0.4;
                const waveAmplitude = amplitudeMin + ((normalizedPoint[7] + 1) / 2) * (amplitudeMax - amplitudeMin);
                
                // Calculate wave phase from dimension 8
                const phaseMin = parseFloat(document.getElementById('phaseMin').value) || 0;
                const phaseMax = parseFloat(document.getElementById('phaseMax').value) || 6.28;
                const wavePhase = phaseMin + ((normalizedPoint[8] + 1) / 2) * (phaseMax - phaseMin);
                
                const ringPoints = [];
                for (let p = 0; p <= numPoints; p++) {
                    const angle = (p / numPoints) * Math.PI * 2;
                    const baseX = Math.cos(angle);
                    const baseZ = Math.sin(angle);
                    
                    // Add undulation effect with amplitude and phase control
                    const undulationEffect = Math.sin(angle * undulations + wavePhase) * waveAmplitude;
                    
                    let displacement = undulationEffect;
                    let dimensionsUsed = 0;
                    
                    for (let d = 9; d < point.length && d < 384; d++) {
                        if (point[d] !== undefined && !isNaN(point[d])) {
                            const weight = Math.sin((d - 9) * angle);
                            displacement += point[d] * weight;
                            dimensionsUsed++;
                        }
                    }
                    
                    if (dimensionsUsed > 0) {
                        displacement = (displacement / Math.sqrt(dimensionsUsed + 1)) * (settings.curveMax - settings.curveMin) + settings.curveMin;
                    }
                    
                    let x = baseX;
                    let y = displacement;
                    let z = baseZ;
                    
                    // Apply rotations
                    const y1 = y * Math.cos(rotationX) - z * Math.sin(rotationX);
                    const z1 = y * Math.sin(rotationX) + z * Math.cos(rotationX);
                    y = y1;
                    z = z1;
                    
                    const x1 = x * Math.cos(rotationZ) - y * Math.sin(rotationZ);
                    const y2 = x * Math.sin(rotationZ) + y * Math.cos(rotationZ);
                    x = x1;
                    y = y2;
                    
                    ringPoints.push(new THREE.Vector3(
                        x * scale * baseRadius,
                        y * scale * baseRadius,
                        z * scale * baseRadius
                    ));
                }
                
                if (ringPoints.length >= 2) {
                    try {
                        // Create a closed curve
                        const curve = new THREE.CatmullRomCurve3(ringPoints, true);
                        
                        // Validate curve
                        const testPoint = curve.getPointAt(0);
                        if (!testPoint || !testPoint.isVector3) {
                            throw new Error('Invalid curve created');
                        }

                        // Create yarn line with thicker line
                        const curvePoints = curve.getPoints(200);
                        const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
                        const material = new THREE.LineBasicMaterial({
                            color: new THREE.Color(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]),
                            transparent: true,
                            opacity: 0.8,
                            linewidth: 2
                        });
                        const yarn = new THREE.Line(geometry, material);
                        
                        // Create animated point
                        const pointGeometry = new THREE.PlaneGeometry(pointSize * 0.2, pointSize * 0.2);
                        const pointMaterial = new THREE.MeshBasicMaterial({
                            color: new THREE.Color(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]),
                            transparent: true,
                            opacity: 1.0,
                            side: THREE.DoubleSide
                        });
                        const pointMesh = new THREE.Mesh(pointGeometry, pointMaterial);
                        
                        // Initialize point position
                        let initialProgress = Math.random();
                        let initialPosition;
                        try {
                            initialPosition = curve.getPointAt(initialProgress);
                            if (!initialPosition || !initialPosition.isVector3) {
                                initialProgress = 0;
                                initialPosition = curve.getPointAt(0);
                            }
                        } catch (e) {
                            initialProgress = 0;
                            initialPosition = ringPoints[0].clone();
                        }
                        
                        pointMesh.position.copy(initialPosition);
                        
                        // Store camera reference to avoid 'this' context issues
                        const camera = this.camera;
                        
                        // Make point always face camera with proper context
                        pointMesh.lookAt(camera.position);
                        pointMesh.onBeforeRender = function() {
                            this.lookAt(camera.position);
                        }.bind(pointMesh);
                        
                        // Log node ID assignment
                        const nodeId = metadata[i]?.node_id;
                        console.log(`Creating point ${i} with node_id: ${nodeId}`);
                        
                        // Store animation data with node_id
                        pointMesh.userData = {
                            curve: curve,
                            progress: initialProgress,
                            velocity: velocity,
                            scatterFrequency: normalizedPoint[9],
                            scatterLength: normalizedPoint[10],
                            scatterColor: normalizedPoint[11],
                            lastScatterTime: null,
                            nextScatterTime: 0,
                            nodeId: nodeId
                        };
                        
                        // Store the same nodeId on the ring for animation
                        yarn.userData = {
                            nodeId: nodeId  // Add nodeId to the ring as well
                        };
                        
                        group.add(yarn);
                        group.add(pointMesh);
                        
                    } catch (error) {
                        console.warn(`Error creating curve for point ${i}:`, error);
                    }
                }
            } catch (error) {
                console.warn('Error creating yarn', i, error);
            }
        });

        // Create origin marker - green wireframe cube with diagonals
        const cubeSize = 0.8;
        const originColor = 0x00ff00;
        
        // Create wireframe cube vertices
        const edges = [
            [-1, -1, -1], [1, -1, -1], [1, -1, -1], [1, 1, -1],
            [1, 1, -1], [-1, 1, -1], [-1, 1, -1], [-1, -1, -1],
            [-1, -1, 1], [1, -1, 1], [1, -1, 1], [1, 1, 1],
            [1, 1, 1], [-1, 1, 1], [-1, 1, 1], [-1, -1, 1],
            [-1, -1, -1], [-1, -1, 1], [1, -1, -1], [1, -1, 1],
            [1, 1, -1], [1, 1, 1], [-1, 1, -1], [-1, 1, 1],
            [-1, -1, -1], [1, 1, 1], [1, -1, -1], [-1, 1, 1],
            [-1, -1, 1], [1, 1, -1], [1, -1, 1], [-1, 1, -1]
        ];

        const points = [];
        for (let i = 0; i < edges.length; i += 2) {
            points.push(
                new THREE.Vector3(edges[i][0] * cubeSize/2, edges[i][1] * cubeSize/2, edges[i][2] * cubeSize/2),
                new THREE.Vector3(edges[i+1][0] * cubeSize/2, edges[i+1][1] * cubeSize/2, edges[i+1][2] * cubeSize/2)
            );
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: originColor,
            linewidth: 2,
            transparent: true,
            opacity: 1.0
        });

        const originMarker = new THREE.LineSegments(geometry, material);
        group.add(originMarker);

        return group;
    }

    redrawScene() {
        if (!this.initialized) {
            console.error('Cannot update: visualization not initialized');
            return;
        }

        console.log('Starting full visualization update');
        
        // Get selected documents with vector databases
        const selectedDocs = document.querySelectorAll('.doc-checkbox:checked');
        const vectorDbDocs = Array.from(selectedDocs).filter(doc => {
            const docItem = doc.closest('.document-item');
            return docItem.querySelector('.vector-db-indicator') !== null;
        });
        
        if (vectorDbDocs.length === 0) {
            console.log('No vector documents selected, clearing visualization');
            this.clearVisualization();
            this.showOverlay('Select documents with vector databases to visualize');
            return;
        }

        // Show loading message
        this.showOverlay('Updating visualization...');

        // Extract citekeys and prepare form data
        const selectedCitekeys = vectorDbDocs.map(doc => doc.id.replace('doc-', ''));
        const formData = new FormData();
        selectedCitekeys.forEach(citekey => formData.append('databases[]', citekey));

        // Add all dimension mappings
        const dimensions = ['x', 'y', 'z', 'w', 'v', 'color', 'undulation', 'amplitude', 'phase', 'scatter_frequency', 'scatter_length', 'scatter_color'];
        dimensions.forEach((dim, index) => {
            formData.append(`${dim}_dimension`, index);
        });

        // Fetch fresh data from server
        fetch('/', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            this.currentData = {
                points: data.points,
                metadata: data.metadata
            };
            // Update with fresh data
            this.redrawYarn(data.points, data.metadata);

            this.hideOverlay();
        })
        .catch(error => {
            console.error('Visualization update error:', error);
            this.showOverlay('Error: ' + error.message, 'error');
        });
    }

    redrawYarn(pointsData, metadata) {
        try {
            console.log('Updating visualization with new settings');
            // Add debug logging for input data
            console.log('Received data for visualization:', {
                pointsData: pointsData?.length ? `${pointsData.length} points` : 'no points',
                metadata: metadata?.length ? `${metadata.length} items` : 'no metadata',
                scene: !!this.scene,
                camera: !!this.camera,
                renderer: !!this.renderer
            });
            console.log('Sample point data:', pointsData?.[0]);
            console.log('Sample metadata:', metadata?.[0]);

            if (!this.camera || !this.scene || !this.renderer) {
                throw new Error('Scene components not properly initialized');
            }

            // Clear existing points
            this.clearVisualization();

            if (!pointsData || pointsData.length === 0) {
                console.warn('No points data received');
                this.showOverlay('No data points to visualize', 'error');
                return;
            }

            // Validate metadata matches points
            if (!metadata || metadata.length !== pointsData.length) {
                console.error('Metadata length mismatch:', {
                    points: pointsData.length,
                    metadata: metadata?.length
                });
                metadata = Array(pointsData.length).fill({database: 'unknown'});
            }

            const colors = this.updateColors(pointsData, metadata);
            let visualization = this.createSemanticYarn(pointsData, colors, metadata);
            
            // Debug the created visualization
            console.log('Visualization created:', {
                success: !!visualization,
                children: visualization?.children?.length || 0
            });

            if (visualization) {
                this.scene.add(visualization);
                this.points.push(visualization);
                this.renderer.render(this.scene, this.camera);
                
                setTimeout(() => {
                    this.hideOverlay();
                }, 100);
            } else {
                throw new Error('Failed to create visualization');
            }

            // Debug logging
            let countAnimated = 0;
            visualization.children.forEach((child, i) => {
                if (child instanceof THREE.Mesh && child.userData && child.userData.curve) {
                    countAnimated++;
                    if (countAnimated <= 3) {
                        console.log(`Animated point ${i}: velocity=${child.userData.velocity}, progress=${child.userData.progress}`);
                    }
                }
            });
            console.log(`Total animated points: ${countAnimated}`);

            // Update the chunk count display
            document.getElementById('chunkCount').textContent = pointsData.length;

            // Reset camera on first visualization
            if (this.firstVisualization) {
                this.zoomExtents();
                this.firstVisualization = false;
            }

            this.hideOverlay();
            console.log('Visualization update complete');

        } catch (error) {
            console.error('Error updating visualization:', error);
            this.showOverlay('Error updating visualization: ' + error.message, 'error');
        }
    }

    handleResize() {
        if (!this.renderer || !this.camera) return;
        
        const canvas = document.getElementById('canvas');
        const container = document.querySelector('#visualization');
        const pixelRatio = window.devicePixelRatio || 1;
        const width = container.clientWidth * pixelRatio;
        const height = container.clientHeight * pixelRatio;
        
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${container.clientWidth}px`;
        canvas.style.height = `${container.clientHeight}px`;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        // Add these lines for proper renderer resizing
        this.renderer.setSize(width, height, false);
        this.renderer.setPixelRatio(pixelRatio);
        this.renderer.setViewport(0, 0, width, height);
    }

    zoomExtents() {
        if (!this.scene || this.points.length === 0) return;

        // Calculate bounding box of all points
        const box = new THREE.Box3();
        this.points[0].traverse((child) => {
            if (child instanceof THREE.Mesh) {
                box.expandByObject(child);
            }
        });

        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fitHeightDistance = maxDim / (2 * Math.tan(Math.PI * this.camera.fov / 360));
        const fitWidthDistance = fitHeightDistance / this.camera.aspect;
        const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.2;

        this.controls.target.copy(center);
        const direction = new THREE.Vector3(1, 1, 1).normalize();
        this.camera.position.copy(center).add(direction.multiplyScalar(distance));
        this.camera.lookAt(center);
        this.camera.updateProjectionMatrix();
        this.controls.update();

        // Force immediate render
        if (this.renderer) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    clearVisualization() {
        if (this.points.length > 0) {
            this.points.forEach(point => {
                if (point && this.scene) {
                    this.scene.remove(point);
                }
            });
            this.points = [];
        }
        
        // Clear scatter lines
        this.scatterLines.forEach(line => {
            if (line && this.scene) {
                this.scene.remove(line);
                if (line.geometry) line.geometry.dispose();
                if (line.material) line.material.dispose();
            }
        });
        this.scatterLines = [];
        
        // Reset current data
        this.currentData = null;
        
        // Update chunk count
        document.getElementById('chunkCount').textContent = '0';

        this.queryAnimationManager.clearAnimations();
    }

    showOverlay(message, type = '') {
        const overlay = document.getElementById('overlay');
        if (overlay) {
            overlay.textContent = message;
            overlay.className = `overlay ${type}`;
            overlay.style.display = 'flex';
            overlay.style.opacity = '1';
            this.isOverlayVisible = true;
            console.log('Showing overlay:', message);
        }
    }

    hideOverlay() {
        const overlay = document.getElementById('overlay');
        if (overlay && this.isOverlayVisible) {
            // Only hide overlay if we're not in the initial state 
            // or if we have selected documents
            const hasSelectedDocs = document.querySelectorAll('.doc-checkbox:checked').length > 0;
            if (hasSelectedDocs || !this.firstVisualization) {
                overlay.style.transition = 'opacity 0.5s ease-out';
                overlay.style.opacity = '0';
                setTimeout(() => {
                    overlay.style.display = 'none';
                    this.isOverlayVisible = false;
                    console.log('Overlay hidden');
                }, 500);
            }
        }
    }

    zoomExtents() {
        if (!this.scene || this.points.length === 0) return;
        
        const box = new THREE.Box3().setFromObject(this.points[0]);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        this.controls.target.copy(center);
        const distance = maxDim * 2;
        const offset = new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(distance);
        this.camera.position.copy(center).add(offset);
        this.camera.lookAt(center);
        this.camera.updateProjectionMatrix();
        this.controls.update();
    }

    clearVisualization() {
        if (this.points.length > 0) {
            this.points.forEach(point => {
                if (point && this.scene) {
                    this.scene.remove(point);
                }
            });
            this.points = [];
        }
        
        // Clear scatter lines
        this.scatterLines.forEach(line => {
            if (line && this.scene) {
                this.scene.remove(line);
                if (line.geometry) line.geometry.dispose();
                if (line.material) line.material.dispose();
            }
        });
        this.scatterLines = [];
        
        // Reset current data
        this.currentData = null;
        
        // Update chunk count
        document.getElementById('chunkCount').textContent = '0';
    }

    handleRetrievedNodes(nodeData) {
        if (!nodeData || !nodeData.length || !this.scene) {
            console.log('No valid node data or scene');
            return;
        }

        // Process each batch of nodes immediately
        nodeData.forEach(data => {
            if (data.node_ids && data.node_ids.length > 0) {
                console.log(`Animating nodes for context '${data.context}':`, data.node_ids);
                // Start animation immediately for this batch
                this.queryAnimationManager.handleRetrievedNodes(data.node_ids, this.scene);
            }
        });
    }

    // Add new method to handle response completion
    handleResponseComplete() {
        console.log('LLM response complete, starting decay phase');
        this.queryAnimationManager.handleResponseComplete();
    }
}
window.VisualizationManager = VisualizationManager;
