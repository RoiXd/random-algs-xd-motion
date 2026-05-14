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

    let container = element.parentElement
    if (!container) container = document.body

    const previousSVG = document.querySelector(".animation-trail")    
    if(previousSVG) container.removeChild(previousSVG)

    const pathSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    pathSVG.setAttribute("xmlns", "http://www.w3.org/2000/svg")
    pathSVG.setAttribute("viewBox", "0 0 100 100")
    pathSVG.setAttribute("width", "100%")
    pathSVG.setAttribute("height", "100%")
    pathSVG.classList.add("animation-trail")
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

    let animationStopped = false

    const trail = new TrailEffect(container, element)
    animation.onfinish = async (event) => {
        setTimeout(() => {
            trail.clear()
            animationStopped = true
        }, 750)
        
    }

    if(tracePath) {
        let animationId: number | null = null
        let startTime: number | null = null

        let deltaTAnim: Derivative | null = null

        function drawPath(timestamp: number) {
            if(animationStopped) return

            if(!startTime) startTime = timestamp

            const currentTime = parseFloat(animation.currentTime!.toString())
            const linearProgress = Math.min(1, currentTime / (duration * 1000))
            const easedProgress = getEasedProgress(linearProgress, easing)  
            
            const currentFrame = Math.floor(easedProgress * (points.length - 1))

            if (currentFrame < points.length) {

                trail.addPoint(
                        points[currentFrame][0] * trail.getCanvasRect().width,
                        (1 - points[currentFrame][1]) * trail.getCanvasRect().height
                    )


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

export class TrailEffect {
    private parent
    private canvas: HTMLCanvasElement
    private followedElement: HTMLElement
    private ctx: CanvasRenderingContext2D
    private trail: Array<{x: number, y: number, age: number}> = []
    private maxLength = 30
    private decay = 0.05  // Disparition progressive
    private margin = 15

    getCanvasRect = () => {
        const rect = { width: this.canvas.width, height: this.canvas.height}
        rect.width = rect.width - this.parent.clientWidth*(this.margin/100)
        rect.height = rect.height - this.parent.clientHeight*(this.margin/100)

        return rect
    }
    setMaxLength = (value: number) => {this.maxLength = value}
    setDecay = (value: number) => {this.decay = value}

    constructor(parent: HTMLElement, followedElement: HTMLElement) {
        this.canvas = document.createElement('canvas')
        this.canvas.style.position = 'absolute'
        this.canvas.style.zIndex = "-10"
        this.canvas.style.top = `-${this.margin/2}%`
        this.canvas.style.left = `-${this.margin/2}%`
        this.canvas.style.width = `${100+this.margin}%`        
        this.canvas.style.height = `${100+this.margin}%`
        this.canvas.style.pointerEvents = 'none'
        this.canvas.width = parent.clientWidth*(1+this.margin/100)  
        this.canvas.height = parent.clientHeight*(1+this.margin/100) 
        
        this.ctx = this.canvas.getContext('2d')!
        parent.appendChild(this.canvas)

        this.parent = parent
        
        this.followedElement = followedElement

        // Adapter la taille au redimensionnement
        window.addEventListener('resize', () => {
            this.canvas.width = parent.clientWidth*(1+this.margin/100)  
            this.canvas.height = parent.clientHeight*(1+this.margin/100) 
        })
    }
    
    addPoint(x: number, y: number) {
        this.trail.unshift({ x: x+this.parent.clientWidth*(this.margin/200), 
            y: y+this.parent.clientHeight*(this.margin/200), age: 1 })
        if (this.trail.length > this.maxLength) {
            this.trail.pop()
        }
        this.draw()
    }
    
    private draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        
        if (this.trail.length < 2) return
        
        // Dessiner la traînée lumineuse
        for (let i = 0; i < this.trail.length - 1; i++) {
            const elRect = this.followedElement.getBoundingClientRect()

            const p1 = this.trail[i]
            const p2 = this.trail[i + 1]
            
            // Opacité décroissante avec l'âge
            const ageFactor = Math.pow(1 - i / this.trail.length, 2)
            const opacity = Math.min(0.8, ageFactor * 0.8)
        
            // Taille du trait décroissante
            const lineWidth =  elRect.width 
            
            // Dégradé de couleur (chaud → froid)
            const hue = 60 - (i / this.trail.length) * 95 // Orange → Rose
            const saturation = 100
            const lightness = 60 + (i / this.trail.length) * 45
            
            this.ctx.beginPath()
            this.ctx.moveTo(p1.x, p1.y)
            this.ctx.lineTo(p2.x, p2.y)
            this.ctx.strokeStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity})`
            this.ctx.lineWidth = lineWidth
            this.ctx.lineCap = 'round'
            this.ctx.stroke()
        }
        
        // Décrémenter l'âge des points (effet fondu)
        this.trail = this.trail.map(p => ({ ...p, age: p.age - this.decay }))
            .filter(p => p.age > 0)
    }
    
    clear() {
        this.parent.removeChild(this.canvas)
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