class QueryAnimationManager {
    constructor() {
        this.activeQueryAnimations = new Map();
        this.debug = false;
        this.decayDuration = 10000;
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

        scene.traverse((object) => {
            if (object instanceof THREE.Line && object?.userData?.nodeId) {
                const nodeId = object.userData.nodeId;
                if (nodeIds.includes(nodeId) && !this.activeQueryAnimations.has(nodeId)) {
                    matchCount++;
                    this.startAnimation(object, currentTime);
                }
            }
        });

        this.log(`Found and animated ${matchCount} matching rings`);
        this.log(`Active animations: ${this.activeQueryAnimations.size}`);
    }

    startAnimation(mesh, startTime = performance.now()) {
        if (!mesh?.userData?.nodeId) {
            this.log('Invalid mesh or missing nodeId');
            return;
        }

        const nodeId = mesh.userData.nodeId;
        this.log(`Starting animation for node: ${nodeId}`);

        const copiedMesh = mesh.clone();
        copiedMesh.material = mesh.material.clone();
        copiedMesh.material.color.set(0xff0000);
        copiedMesh.material.transparent = false;
        copiedMesh.userData = { ...mesh.userData, isAnimationCopy: true };
        
        if (copiedMesh.geometry.isBufferGeometry) {
            const positions = copiedMesh.geometry.attributes.position.array;
            copiedMesh.userData.originalVertices = Float32Array.from(positions);
        }
        
        mesh.parent.add(copiedMesh);

        this.activeQueryAnimations.set(nodeId, {
            startTime,
            decayStartTime: null,
            originalMesh: mesh,
            animatedMesh: copiedMesh,
            phase: 'highlight',
            isResponding: true
        });

        this.log(`Animation started for ${nodeId} with copied ring`);
    }

    updateAnimation(mesh, currentTime) {
        if (!mesh?.userData?.nodeId) return false;
    
        const nodeId = mesh.userData.nodeId;
        const animData = this.activeQueryAnimations.get(nodeId);
        if (!animData) return false;
    
        const elapsed = currentTime - animData.startTime;
        const copiedMesh = animData.animatedMesh;
        
        if (animData.phase === 'highlight') {
            if (copiedMesh instanceof THREE.Line) {
                const baseFreq = 0.02;
                const positions = copiedMesh.geometry.attributes.position;
                const originalPositions = copiedMesh.userData.originalVertices;
                
                for (let i = 0; i < positions.count; i++) {
                    const idx = i * 3;
                    const vertexPhase = i / positions.count;
                    
                    const time = elapsed * baseFreq;
                    const jitterX = Math.random() * Math.sin(time + vertexPhase * Math.PI * 2) * 0.1;
                    const jitterY = Math.random() * Math.cos(time * 1.5 + vertexPhase * Math.PI * 3) * 0.2;
                    const jitterZ = Math.random() * Math.sin(time * 0.8 - vertexPhase * Math.PI) * 0.05;
                    
                    positions.array[idx] = originalPositions[idx] + jitterX;
                    positions.array[idx + 1] = originalPositions[idx + 1] + jitterY;
                    positions.array[idx + 2] = originalPositions[idx + 2] + jitterZ;
                }
                
                positions.needsUpdate = true;
                
                const transitionDuration = 2000;
                const colorPhase = Math.min(1, elapsed / transitionDuration);
            
                const originalColor = animData.originalMesh.material.color;
                const brightRed = new THREE.Color('#ff8888');
                copiedMesh.material.color.copy(originalColor).lerp(brightRed, colorPhase);
                copiedMesh.material.needsUpdate = true;
            }
            return true;
        } else if (animData.phase === 'decay') {
            const decayElapsed = currentTime - animData.decayStartTime;
            const decayPhase = Math.max(0, 1 - (decayElapsed / this.decayDuration));
            
            if (decayPhase <= 0) {
                copiedMesh.parent.remove(copiedMesh);
                copiedMesh.geometry.dispose();
                copiedMesh.material.dispose();
                this.activeQueryAnimations.delete(nodeId);
                return false;
            }
            
            if (copiedMesh instanceof THREE.Line) {
                const positions = copiedMesh.geometry.attributes.position;
                const originalPositions = copiedMesh.userData.originalVertices;
                
                for (let i = 0; i < positions.count; i++) {
                    const idx = i * 3;
                    const returnPhase = Math.pow(decayPhase, 2);
                    
                    positions.array[idx] = originalPositions[idx] + (positions.array[idx] - originalPositions[idx]) * returnPhase;
                    positions.array[idx + 1] = originalPositions[idx + 1] + (positions.array[idx + 1] - originalPositions[idx + 1]) * returnPhase;
                    positions.array[idx + 2] = originalPositions[idx + 2] + (positions.array[idx + 2] - originalPositions[idx + 2]) * returnPhase;
                }
                
                positions.needsUpdate = true;
                
                const originalColor = animData.originalMesh.material.color;
                copiedMesh.material.color.lerp(originalColor, 1 - decayPhase);
                copiedMesh.material.needsUpdate = true;
            }
        }
        return true;
    }

    handleResponseComplete() {
        const currentTime = performance.now();
        this.log(`Response complete - starting decay for responding animations`);
        
        this.activeQueryAnimations.forEach((animData, nodeId) => {
            if (animData.isResponding && animData.phase === 'highlight') {
                animData.phase = 'decay';
                animData.decayStartTime = currentTime;
                animData.isResponding = false;
                this.log(`Started decay for node: ${nodeId}`);
            }
        });
    }

    clearAnimations() {
        this.log(`Clearing ${this.activeQueryAnimations.size} active animations`);
        
        this.activeQueryAnimations.forEach((animData) => {
            const copiedMesh = animData.animatedMesh;
            if (copiedMesh && copiedMesh.parent)
                copiedMesh.parent.remove(copiedMesh);
                copiedMesh.geometry.dispose();
                copiedMesh.material.dispose();
            }
        );
        
        this.activeQueryAnimations.clear();
    }
}
// Export for use in other files
window.QueryAnimationManager = QueryAnimationManager;