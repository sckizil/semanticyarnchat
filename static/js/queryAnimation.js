class QueryAnimationManager {
    constructor() {
        this.activeQueryAnimations = new Map();
        this.debug = true; // Enable debug logging temporarily
        
        // Global timing variables
        this.decayDuration = 5000; // 10 seconds decay
        this.fadeToGrayscaleDuration = 1000; // 1 second to fade to grayscale
        this.highlightFadeDuration = 2000; // 2 seconds to fade in highlighted nodes
        
        // Scene state tracking
        this.isQueryActive = false;
        this.affectedObjects = new Set(); // Track all affected objects
        this.originalMaterials = new Map(); // Store original materials
        this.queryStartTime = 0;
        this.decayStartTime = null; // Add this missing property
        
        // Matrix effect parameters
        this.ghostCount = 7; // Number of ghost copies
        this.ghostDistance = 0.1; // Distance between ghosts
        this.ghostOpacity = 0.4; // Opacity of ghost copies
        this.vibrationSpeed = 0.03; // Speed of vibration effect
        this.vibrationAmount = 0.1; // Amount of position change
        this.ghostObjects = new Map(); // Store ghost objects
    }

    log(message) {
        if (this.debug) console.log(`[QueryAnimation] ${message}`);
    }

    handleRetrievedNodes(nodeIds, scene) {
        if (!Array.isArray(nodeIds) || !scene) {
            this.log('Invalid input: nodeIds must be an array and scene must be provided');
            return;
        }

        const currentTime = performance.now();
        
        // First time nodes are retrieved, start the global effect
        if (!this.isQueryActive) {
            this.isQueryActive = true;
            this.queryStartTime = currentTime;
            this.applyGrayscaleEffect(scene);
            this.log(`Starting query mode - turning visualization to B&W`);
        }

        this.log(`\n=== Processing Retrieved Nodes ===`);
        this.log(`Processing ${nodeIds.length} node IDs: ${nodeIds.join(', ')}`);

        let matchCount = 0;

        // Find all matching nodes
        scene.traverse((object) => {
            // Check for both nodeId and node_id in userData
            const objectNodeId = object?.userData?.nodeId || object?.userData?.node_id;
            
            if ((object instanceof THREE.Line || object instanceof THREE.Mesh) && objectNodeId) {
                if (nodeIds.includes(objectNodeId) && !this.activeQueryAnimations.has(objectNodeId)) {
                    matchCount++;
                    this.highlightNode(object, currentTime);
                }
            }
        });

        this.log(`Found and highlighted ${matchCount} matching objects`);
    }

    highlightNode(object, startTime = performance.now()) {
        // Check for both nodeId and node_id in userData
        const nodeId = object?.userData?.nodeId || object?.userData?.node_id;
        
        if (!nodeId) {
            this.log('Invalid object or missing nodeId');
            return;
        }

        this.log(`Highlighting node: ${nodeId}`);

        // Store original material if not already stored
        if (!this.originalMaterials.has(object.id)) {
            this.originalMaterials.set(object.id, {
                color: object.material.color.clone(),
                opacity: object.material.opacity,
                transparent: object.material.transparent
            });
        }

        // Set initial highlight state
        object.material.transparent = true;
        object.material.needsUpdate = true;

        // Create ghost copies for Matrix effect
        this.createGhostCopies(object);

        this.activeQueryAnimations.set(nodeId, {
            startTime,
            decayStartTime: null,
            object: object,
            phase: 'highlight',
            isResponding: true,
            lastVibrationUpdate: startTime,
            vibrationOffset: { x: 0, y: 0, z: 0 }
        });

        this.log(`Animation started for ${nodeId}`);
    }

    createGhostCopies(object) {
        if (!object?.userData?.nodeId) return;
        const nodeId = object.userData.nodeId;
        
        // Remove any existing ghosts for this node
        this.removeGhostCopies(nodeId);
        
        const ghosts = [];
        
        // Create ghost copies
        for (let i = 0; i < this.ghostCount; i++) {
            // Clone the object for ghost effect
            let ghost;
            
            if (object instanceof THREE.Line) {
                // For lines, we need to clone the geometry
                const ghostGeometry = object.geometry.clone();
                ghost = new THREE.Line(
                    ghostGeometry,
                    object.material.clone()
                );
            } else if (object instanceof THREE.Mesh) {
                // For meshes
                ghost = new THREE.Mesh(
                    object.geometry,
                    object.material.clone()
                );
            } else {
                continue; // Skip if not a supported type
            }
            
            // Copy position and rotation
            ghost.position.copy(object.position);
            ghost.rotation.copy(object.rotation);
            ghost.scale.copy(object.scale);
            
            // Make semi-transparent
            ghost.material.transparent = true;
            ghost.material.opacity = this.ghostOpacity / (i + 1);
            ghost.material.color = new THREE.Color(0.8, 0, 0); // Reddish
            ghost.material.needsUpdate = true;
            
            // Add to scene
            if (object.parent) {
                object.parent.add(ghost);
            }
            
            // Store reference
            ghosts.push(ghost);
        }
        
        this.ghostObjects.set(nodeId, ghosts);
    }

    removeGhostCopies(nodeId) {
        const ghosts = this.ghostObjects.get(nodeId);
        if (ghosts) {
            ghosts.forEach(ghost => {
                if (ghost.parent) {
                    ghost.parent.remove(ghost);
                }
                if (ghost.geometry) {
                    ghost.geometry.dispose();
                }
                if (ghost.material) {
                    ghost.material.dispose();
                }
            });
        }
        this.ghostObjects.delete(nodeId);
    }

    updateAnimation(object, currentTime) {
        // Global scene effect update
        if (this.isQueryActive) {
            this.updateGlobalEffect(currentTime);
        }
        
        if (!object?.userData?.nodeId) return false;
    
        const nodeId = object.userData.nodeId;
        const animData = this.activeQueryAnimations.get(nodeId);
        if (!animData) return false;
    
        const elapsed = currentTime - animData.startTime;
        
        if (animData.phase === 'highlight') {
            // Gradually increase opacity and turn red
            const fadeInProgress = Math.min(1, elapsed / this.highlightFadeDuration);
            
            // Get original color
            const originalMaterial = this.originalMaterials.get(object.id);
            if (!originalMaterial) return true;
            
            // Transition to bright red
            const redColor = new THREE.Color(1, 0, 0);
            object.material.color.copy(redColor);
            
            // Increase opacity from grayscale level to full
            object.material.opacity = 0.3 + (fadeInProgress * 0.7);
            
            // Add pulsing effect
            const pulseFreq = 0.002;
            const pulseIntensity = 0.2;
            const pulse = 1 + (Math.sin(elapsed * pulseFreq) * pulseIntensity);
            object.material.opacity *= pulse;
            
            // Update Matrix-style vibration effect
            this.updateMatrixEffect(object, nodeId, animData, currentTime);
            
            object.material.needsUpdate = true;
            return true;
        } else if (animData.phase === 'decay') {
            const decayElapsed = currentTime - animData.decayStartTime;
            const decayProgress = Math.min(1, decayElapsed / this.decayDuration);
            
            if (decayProgress >= 1) {
                // Animation complete, remove ghost copies
                this.removeGhostCopies(nodeId);
                // Don't restore yet - that happens in clearAnimations
                this.activeQueryAnimations.delete(nodeId);
                return false;
            }
            
            // Get original material
            const originalMaterial = this.originalMaterials.get(object.id);
            if (!originalMaterial) return true;
            
            // Transition from red to original color
            const redColor = new THREE.Color(1, 0, 0);
            object.material.color.copy(redColor).lerp(originalMaterial.color, decayProgress);
            
            // Keep full opacity during decay
            object.material.opacity = 1.0;
            
            // Continue Matrix effect but reduce intensity as we decay
            this.updateMatrixEffect(object, nodeId, animData, currentTime, 1 - decayProgress);
            
            object.material.needsUpdate = true;
            return true;
        }
        
        return false;
    }
    
    updateMatrixEffect(object, nodeId, animData, currentTime, intensityMultiplier = 1) {
        // Update vibration effect (slight position changes)
        const timeSinceLastUpdate = currentTime - animData.lastVibrationUpdate;
        
        if (timeSinceLastUpdate > 50) { // Update every 50ms for performance
            // Random vibration offset
            const vibAmount = this.vibrationAmount * intensityMultiplier;
            animData.vibrationOffset = {
                x: (Math.random() * 2 - 1) * vibAmount,
                y: (Math.random() * 2 - 1) * vibAmount,
                z: (Math.random() * 2 - 1) * vibAmount
            };
            animData.lastVibrationUpdate = currentTime;
            
            // Update ghost positions with offset
            const ghosts = this.ghostObjects.get(nodeId);
            if (ghosts) {
                ghosts.forEach((ghost, index) => {
                    const multiplier = (index + 1) * this.ghostDistance;
                    ghost.position.x = object.position.x + (animData.vibrationOffset.x * multiplier);
                    ghost.position.y = object.position.y + (animData.vibrationOffset.y * multiplier);
                    ghost.position.z = object.position.z + (animData.vibrationOffset.z * multiplier);
                    
                    // Adjust opacity based on pulse
                    const pulseFreq = 0.002;
                    const pulse = Math.sin((currentTime + index * 200) * pulseFreq);
                    ghost.material.opacity = (this.ghostOpacity / (index + 1)) * (0.7 + 0.3 * pulse) * intensityMultiplier;
                    ghost.material.needsUpdate = true;
                });
            }
        }
    }

    handleResponseComplete() {
        const currentTime = performance.now();
        this.log(`Response complete - starting decay for all animations`);
        
        // Start decay for all active animations
        this.activeQueryAnimations.forEach((animData, nodeId) => {
            if (animData.isResponding && animData.phase === 'highlight') {
                animData.phase = 'decay';
                animData.decayStartTime = currentTime;
                animData.isResponding = false;
                this.log(`Started decay for node: ${nodeId}`);
            }
        });
        
        // Store decay start time for global effect
        this.decayStartTime = currentTime;
        
        // Schedule restoration of all objects
        setTimeout(() => {
            this.clearAnimations();
        }, this.decayDuration);
    }

    applyGrayscaleEffect(scene) {
        this.affectedObjects.clear();
        this.originalMaterials.clear();
        
        // Process all visible objects in the scene
        scene.traverse((object) => {
            if ((object instanceof THREE.Mesh || object instanceof THREE.Line || 
                 object instanceof THREE.Points) && object.material && object.visible) {
                
                // Store original material properties
                const originalMaterial = {
                    color: object.material.color.clone(),
                    opacity: object.material.opacity,
                    transparent: object.material.transparent
                };
                
                this.originalMaterials.set(object.id, originalMaterial);
                this.affectedObjects.add(object);
                
                // Make material transparent for transition
                object.material.transparent = true;
                object.material.needsUpdate = true;
            }
        });
        
        this.log(`Applied grayscale effect to ${this.affectedObjects.size} objects`);
    }

    updateGlobalEffect(currentTime) {
        if (!this.isQueryActive) return;
        
        const elapsed = currentTime - this.queryStartTime;
        
        // If we're in decay phase
        if (this.decayStartTime) {
            const decayElapsed = currentTime - this.decayStartTime;
            const decayProgress = Math.min(1, decayElapsed / this.decayDuration);
            
            // Gradually restore all non-highlighted objects to original colors
            this.affectedObjects.forEach(object => {
                if (!this.activeQueryAnimations.has(object?.userData?.nodeId)) {
                    const originalMaterial = this.originalMaterials.get(object.id);
                    if (originalMaterial && object.material) {
                        // Transition from grayscale back to original color
                        object.material.color.lerp(originalMaterial.color, decayProgress);
                        
                        // Restore original opacity
                        object.material.opacity = 0.3 + (decayProgress * (originalMaterial.opacity - 0.3));
                        
                        // Special handling for Points (moving particles)
                        if (object instanceof THREE.Points) {
                            // Ensure points remain visible but desaturated
                            object.material.opacity = Math.max(0.7, originalMaterial.opacity);
                        }
                        
                        object.material.needsUpdate = true;
                    }
                }
            });
        } 
        // Initial grayscale phase
        else {
            const fadeProgress = Math.min(1, elapsed / this.fadeToGrayscaleDuration);
            
            this.affectedObjects.forEach(object => {
                if (!this.activeQueryAnimations.has(object?.userData?.nodeId)) {
                    const originalMaterial = this.originalMaterials.get(object.id);
                    if (originalMaterial && object.material) {
                        // Special handling for Points (moving particles)
                        if (object instanceof THREE.Points) {
                            // Keep points visible but desaturate them
                            const color = originalMaterial.color;
                            const gray = (color.r + color.g + color.b) / 3;
                            const desaturatedColor = new THREE.Color(
                                color.r * 0.3 + gray * 0.7,
                                color.g * 0.3 + gray * 0.7,
                                color.b * 0.3 + gray * 0.7
                            );
                            object.material.color.copy(color).lerp(desaturatedColor, fadeProgress);
                            object.material.opacity = Math.max(0.7, originalMaterial.opacity);
                        } else {
                            // Convert to grayscale for other objects
                            const color = originalMaterial.color;
                            const gray = (color.r + color.g + color.b) / 3;
                            const grayColor = new THREE.Color(gray, gray, gray);
                            
                            // Interpolate between original and gray
                            object.material.color.copy(color).lerp(grayColor, fadeProgress);
                            
                            // Reduce opacity
                            const targetOpacity = 0.3;
                            object.material.opacity = originalMaterial.opacity - 
                                (fadeProgress * (originalMaterial.opacity - targetOpacity));
                        }
                        
                        object.material.needsUpdate = true;
                    }
                }
            });
        }
    }

    clearAnimations() {
        this.log(`Clearing animations and restoring original appearance`);
        
        // Remove all ghost objects
        this.ghostObjects.forEach((ghosts, nodeId) => {
            this.removeGhostCopies(nodeId);
        });
        
        // Restore all affected objects to their original state
        this.affectedObjects.forEach(object => {
            const originalMaterial = this.originalMaterials.get(object.id);
            if (originalMaterial && object.material) {
                object.material.color.copy(originalMaterial.color);
                object.material.opacity = originalMaterial.opacity;
                object.material.transparent = originalMaterial.transparent;
                object.material.needsUpdate = true;
            }
        });
        
        // Clear all tracking collections
        this.activeQueryAnimations.clear();
        this.affectedObjects.clear();
        this.originalMaterials.clear();
        this.ghostObjects.clear();
        this.isQueryActive = false;
        
        this.log("Query animation cleared, visualization restored to normal");
    }
}

// Export for use in other files
window.QueryAnimationManager = QueryAnimationManager;