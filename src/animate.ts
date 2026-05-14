type AnimationOptions = {
    easing?: string
    scale?: number | null
    tracePath?: boolean
    trailStyle?: {
        stroke?: string
        strokeOpacity?: string
        strokeWidth?: string
        strokeDasharray?: string
        strokeDashoffset?: string 
    }
}

type MathematicFunction = (x: number) => number

export function fn2Animation(element: HTMLElement, 
fn: MathematicFunction, 
range: [number, number], 
fps: number, 
duration: number, 
options: AnimationOptions = {}) {
    
    // Assertions
    if(range[0] === range[1]) return null
    range = range.sort((x, y) => x > y ? 1 : -1)
    
    
    const {easing="linear", scale=null, tracePath=false, trailStyle={stroke: "orange", strokeWidth: "0.1px",}} = options
    const [a, b] = range
    
    // Positionner l'élément en absolute pour l'animation
    element.style.position = 'absolute'
    if (element.parentElement && getComputedStyle(element.parentElement).position === 'static') {
        element.parentElement.style.position = 'relative'
    }
    
    // Création du SVG pour le tracé
    let container = element.parentElement
    if (!container) container = document.body
    
    const pathSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    pathSVG.setAttribute("xmlns", "http://www.w3.org/2000/svg")
    pathSVG.setAttribute("viewBox", "0 0 100 100")
    pathSVG.setAttribute("width", "100%")
    pathSVG.setAttribute("height", "100%")
    pathSVG.style.position = 'absolute'
    pathSVG.style.top = '0'
    pathSVG.style.left = '0'
    pathSVG.style.pointerEvents = 'none'  // Pour ne pas interférer avec les clics
    pathSVG.setAttribute('preserveAspectRatio', 'none')
    
    container.appendChild(pathSVG)
    
    const path = document.createElementNS("http://www.w3.org/2000/svg", "polyline")
    path.setAttribute("fill", "none")
    path.setAttribute("stroke", trailStyle.stroke ?? "black")
    path.setAttribute("stroke-width", trailStyle.strokeWidth ?? "0.5px")
    path.setAttribute("stroke-opacity", trailStyle.strokeOpacity ?? "1")
    if(trailStyle.strokeDasharray) path.setAttribute("stroke-dasharray", trailStyle.strokeDasharray)
    if(trailStyle.strokeDashoffset) path.setAttribute("stroke-dashoffset", trailStyle.strokeDashoffset)
    path.setAttribute("stroke-linejoin", "round")
    path.setAttribute("stroke-linecap", "round")
    pathSVG.appendChild(path)
    
    // Génération des points
    let points: Array<[number, number]> = []
    const dx = (b - a) / (fps * duration)
    
    for(let x = a; x <= b; x += dx) {
        points.push([x, fn(x)])
    }
    
    if(scale) {
        points = points.map(p => [scale * p[0], scale * p[1]])
    } else {
        const normx = (x: number) => (x - a) / (b - a)
        const yaxis = points.map(p => p[1])
        const minY = Math.min(...yaxis)
        const maxY = Math.max(...yaxis)
        const interval = maxY - minY
        const normy = interval !== 0 ? (y: number) => (y - minY) / interval : () => 0.5
        points = points.map(p => [normx(p[0]), normy(p[1])])
    }
    
    const pointsToDraw: [number, number][] = []

    const keyframes = points.map(pt => ({
        left: `${pt[0] * 100}%`,
        bottom: `${pt[1] * 100}%`
    }))

    const animation = element.animate(keyframes, {
        duration: duration * 1000,
        easing: easing,
        iterations: 1,
        fill: 'forwards'
    })

    // Animation du tracé
    if(tracePath) {
        let animationId: number | null = null
        let startTime: number | null = null
        let elapsed: number = 0

        let delta2TAnimTime: Derivative | null = null

        function drawPath(timestamp: number) {
            if(!startTime) startTime = timestamp

            const currentTime = parseFloat(animation.currentTime!.toString())
            const linearProgress = Math.min(1, currentTime / (duration * 1000))
            const easedProgress = getEasedProgress(linearProgress, easing)  
            
            const currentFrame = Math.floor(easedProgress * (points.length - 1))

            if (currentFrame < points.length) {

                pointsToDraw.push([points[currentFrame][0] * 100, (1 - points[currentFrame][1]) * 100])

                const pointsString = pointsToDraw.map(p => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join(' ')
                path.setAttribute("points", pointsString)
                
                animationId = requestAnimationFrame(drawPath)
            }
        }
        animationId = requestAnimationFrame(drawPath)
    }
    
    return animation
}

// Fonction de diagnostic (garde-la)
function diagnostiquerPolyline(svgSelector: string, polylineSelector: string) {
    const svg = document.querySelector(svgSelector);
    const polyline = svg?.querySelector(polylineSelector);
    
    if (!svg) console.error('❌ SVG non trouvé');
    if (!polyline) console.error('❌ Polyline non trouvé');
    
    if (polyline) {
        console.log('Points:', polyline.getAttribute('points')?.substring(0, 200));
        console.log('Stroke:', polyline.getAttribute('stroke'));
        console.log('Stroke-width:', polyline.getAttribute('stroke-width'));
    }
    
    return { svg, polyline };
}

function getEasedProgress(linearProgress: number, easing: string): number {
    switch (easing) {
        case 'linear':
            return linearProgress
        case 'ease':
        case 'ease-in-out':
            return linearProgress < 0.5
                ? 4 * linearProgress * linearProgress * linearProgress
                : 1 - Math.pow(-2 * linearProgress + 2, 3) / 2
        case 'ease-in':
            return linearProgress * linearProgress
        case 'ease-out':
            return 1 - (1 - linearProgress) * (1 - linearProgress)
        default:
            return linearProgress
    }
}


type Getter<T> = () => T 

class Derivative {
    f: Getter<number>;
    x: Getter<number>;
    private x_history: number[] = [];
    private f_history: number[] = [];
    
    constructor(f: Getter<number>, x: Getter<number>) {
        this.f = f;
        this.x = x;
        this.x_history.push(x());
        this.f_history.push(f());
    }
    
    // Recursive method that updates and returns all derivatives
    calcNext(maxOrder: number = 3): Map<number, number> {
        // Add new data point
        this.x_history.push(this.x());
        this.f_history.push(this.f());
        
        // Trim history if needed
        if (this.x_history.length > maxOrder + 10) {
            this.x_history.shift();
            this.f_history.shift();
        }
        
        // Recursively compute derivatives
        const derivatives = new Map<number, number>();
        
        const computeDerivative = (order: number, startIdx: number, endIdx: number): number => {
            if (order === 0) {
                return this.f_history[endIdx];
            }
            
            if (endIdx - startIdx < order) {
                return 0;
            }
            
            // Recursive call for lower order derivatives
            const leftDeriv = computeDerivative(order - 1, startIdx, endIdx - 1);
            const rightDeriv = computeDerivative(order - 1, startIdx + 1, endIdx);
            
            const x_left = this.x_history[endIdx - 1];
            const x_right = this.x_history[endIdx];
            
            return (rightDeriv - leftDeriv) / (x_right - x_left);
        };
        
        // Calculate derivatives from 1 to maxOrder recursively
        const calculateAll = (currentOrder: number): void => {
            if (currentOrder > maxOrder) return;
            
            const lastIdx = this.x_history.length - 1;
            const deriv = computeDerivative(
                currentOrder, 
                0, 
                lastIdx
            );
            derivatives.set(currentOrder, deriv);
            calculateAll(currentOrder + 1);
        };
        
        calculateAll(1);
        return derivatives;
    }
    
    // Simple recursive method for just the next derivative
    calcNextDerivative(order: number = 1): number {
        if (order === 0) {
            return this.f();
        }
        
        // Add new point if needed (call this before recursion)
        const needsUpdate = this.x_history[this.x_history.length - 1] !== this.x();
        if (needsUpdate) {
            this.x_history.push(this.x());
            this.f_history.push(this.f());
        }
        
        const n = this.x_history.length;
        if (n < order + 1) return 0;
        
        // Recursive definition of derivative
        const leftDeriv = this.calcNextDerivativeRecursive(order - 1, 0, n - 2);
        const rightDeriv = this.calcNextDerivativeRecursive(order - 1, 1, n - 1);
        
        return (rightDeriv - leftDeriv) / (this.x_history[n-1] - this.x_history[n-2]);
    }
    
    private calcNextDerivativeRecursive(order: number, start: number, end: number): number {
        if (order === 0) {
            return this.f_history[end];
        }
        
        if (end - start < order) {
            return 0;
        }
        
        const leftDeriv = this.calcNextDerivativeRecursive(order - 1, start, end - 1);
        const rightDeriv = this.calcNextDerivativeRecursive(order - 1, start + 1, end);
        
        return (rightDeriv - leftDeriv) / (this.x_history[end] - this.x_history[start]);
    }
}