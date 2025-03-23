class QueryAnimationManager {
    constructor() {
        this.activeAnimations = new Map();
        this.debug = true;
    }

    log(message) {
        if (this.debug) console.log(`[QueryAnimation] ${message}`);
    }

    handleRetrievedNodes(nodeIds, scene) {
        if (!Array.isArray(nodeIds) || !scene) {
            this.log('Invalid input: nodeIds must be an array and scene must be provided');
            return;
        }

        this.log(`\n=== Query Animation Start ===`);
        this.log(`Processing ${nodeIds.length} node IDs: ${nodeIds.join(', ')}`);

        const currentTime = performance.now();
        let matchCount = 0;
        
        // Clear existing animations first
        this.clearAnimations();

        // Debug: Log all available nodes
        const availableNodeIds = new Set();
        scene.traverse((object) => {
            if (object?.userData?.nodeId) {
                availableNodeIds.add(object.userData.nodeId);
            }
        });
        
        this.log(`Available node IDs in scene: ${Array.from(availableNodeIds).join(', ')}`);
        this.log(`Looking for node IDs: ${nodeIds.join(', ')}`);

        // Find and animate matching rings
        scene.traverse((object) => {
            if (object instanceof THREE.Line && object?.userData?.nodeId) {
                const nodeId = object.userData.nodeId;
                const isMatch = nodeIds.includes(nodeId);
                
                this.log(`Checking ring with ID ${nodeId}: ${isMatch ? 'MATCH' : 'no match'}`);
                
                if (isMatch) {
                    matchCount++;
                    this.startAnimation(object, currentTime);
                }
            }
        });

        this.log(`Found and animated ${matchCount} matching rings`);
        this.log(`Active animations: ${this.activeAnimations.size}`);
        
    }

    startAnimation(mesh, startTime = performance.now()) {
        if (!mesh?.userData?.nodeId) {
            this.log('Invalid mesh or missing nodeId');
            return;
        }

        const nodeId = mesh.userData.nodeId;
        this.log(`Starting animation for node: ${nodeId}`);

        // Store original material properties
        if (mesh instanceof THREE.Line) {
            mesh.userData.originalOpacity = mesh.material.opacity;
            mesh.userData.originalLinewidth = mesh.material.linewidth;
            mesh.userData.originalColor = mesh.material.color.clone(); // Store original color
        }

        // Create animation data with phase control
        this.activeAnimations.set(nodeId, {
            startTime,
            decayStartTime: null,  // Will be set when decay phase starts
            mesh,
            originalProps: {
                opacity: mesh.material.opacity,
                linewidth: mesh.material.linewidth,
                color: mesh.material.color.clone() // Store color in props
            },
            phase: 'highlight'  // Initial phase is highlight without decay
        });
    }

    updateAnimation(mesh, currentTime) {
        if (!mesh?.userData?.nodeId) return false;

        const nodeId = mesh.userData.nodeId;
        const animData = this.activeAnimations.get(nodeId);
        if (!animData) return false;

        const elapsed = currentTime - animData.startTime;
        
        // Handle different animation phases
        if (animData.phase === 'highlight') {
            // Just pulse without decay
            if (mesh instanceof THREE.Line) {
                const basePulse = (Math.sin(elapsed * 0.008) + 1) * 0.5; // Faster frequency
                const colorPhase = (Math.sin(elapsed * 0.003) + 1) * 0.5; // Slower color shift
                
                mesh.material.opacity = 0.4 + basePulse * 0.6; // More visible base opacity
                mesh.material.linewidth = 1 + basePulse * 5; // More dramatic line width
                
                // Add color shifting
                mesh.material.color.setHSL(0.6 + colorPhase * 0.1, 1, 0.5);
                mesh.material.needsUpdate = true;
            }
            return true;
        } else if (animData.phase === 'decay') {
            // Calculate decay based on when decay phase started
            const decayElapsed = currentTime - animData.decayStartTime;
            const decayPhase = Math.max(0, 1 - (decayElapsed / 10000)); // 10 second decay

            if (decayPhase <= 0) {
                // Animation complete
                if (mesh instanceof THREE.Line) {
                    mesh.material.opacity = animData.originalProps.opacity;
                    mesh.material.linewidth = animData.originalProps.linewidth;
                    mesh.material.color.copy(animData.originalProps.color);
                    mesh.material.needsUpdate = true;
                }
                this.activeAnimations.delete(nodeId);
                return false;
            }

            // Apply decay effect
            if (mesh instanceof THREE.Line) {
                const basePulse = (Math.sin(elapsed * 0.008) + 1) * 0.5;
                const colorPhase = (Math.sin(elapsed * 0.003) + 1) * 0.5;
                const pulseWithDecay = basePulse * decayPhase;
                
                mesh.material.opacity = 0.4 + pulseWithDecay * 0.6;
                mesh.material.linewidth = 1 + pulseWithDecay * 5;
                mesh.material.color.setHSL(0.6 + colorPhase * 0.1, 1, 0.5);
                mesh.material.needsUpdate = true;
            }
        }

        return true;
    }

    startDecayPhase() {
        const currentTime = performance.now();
        this.log(`Starting decay phase for ${this.activeAnimations.size} animations`);
        
        this.activeAnimations.forEach((animData, nodeId) => {
            if (animData.phase === 'highlight') {
                animData.phase = 'decay';
                animData.decayStartTime = currentTime;
                this.log(`Started decay for node: ${nodeId}`);
            }
        });
    }

    clearAnimations() {
        this.log(`Clearing ${this.activeAnimations.size} active animations`);
        
        this.activeAnimations.forEach((animData) => {
            const mesh = animData.mesh;
            if (mesh instanceof THREE.Line) {
                mesh.material.opacity = animData.originalProps.opacity;
                mesh.material.linewidth = animData.originalProps.linewidth;
                mesh.material.color.copy(animData.originalProps.color);
                mesh.material.needsUpdate = true;
            }
        });
        
        this.activeAnimations.clear();
    }
}

// Export for use in other files
window.QueryAnimationManager = QueryAnimationManager;
