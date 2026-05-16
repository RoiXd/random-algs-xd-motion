import type { MathematicFunction } from "../util/types.ts"

type AnimationOptions = {
    easing?: string
    scale?: number | null
    tracePath?: boolean
    traceStyle?: TraceEffectOptions
    enableTrail?: boolean,
    trailStyle?: TrailEffectOptions
}

export function fn2Animation(element: HTMLElement, 
fn: MathematicFunction, 
range: [number, number], 
fps: number, 
duration: number, 
options: AnimationOptions = {}) {
    
    // Assertions
    if(range[0] === range[1]) return null
    range = range.sort((x, y) => x > y ? 1 : -1)
    
    
    const { easing="linear", 
        scale=null, 
        tracePath=false, 
        traceStyle={stroke: "orange", strokeWidth: "0.1px",},
        enableTrail=true,
        trailStyle={}
    } = options
    const [a, b] = range

    let container = element.parentElement
    if (!container) container = document.body

    const previousSVG = document.querySelector(".animation-trace")    
    if(previousSVG) container.removeChild(previousSVG)
    
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

    let animationStopped = false // Keep it as we will use it later

    const trail = enableTrail ? new TrailEffect(container, element, trailStyle) : null

     // Initialize TraceEffect if needed
    let stopTracing: (() => void) | null = null

    let trace: TraceEffect | null = null
    if(tracePath) {
        trace = new TraceEffect(container, traceStyle)
        
        stopTracing = trace.startTracing(
            animation,
            duration,
            points,
            easing
        )
    }
    if(enableTrail) {
        let startTime: number | null = null
        function refreshTrail(timestamp: number) {
            if (!trail || animationStopped) return

            if (!startTime) startTime = timestamp

            const currentTime = parseFloat(animation.currentTime!.toString())
            const linearProgress = Math.min(1, currentTime / (duration * 1000))
            const easedProgress = getEasedProgress(linearProgress, easing)
            
            const currentFrame = Math.floor(easedProgress * (points.length - 1))
            const point = points.at(currentFrame)
            const canvasRect = trail.getCanvasRect()
            if(point) 
                trail.addPoint(
                    point[0] * canvasRect.width,
                    (1 - point[1]) * canvasRect.height
                )
            requestAnimationFrame(refreshTrail)
        }
        requestAnimationFrame(refreshTrail)
    }

    animation.onfinish = (event) => {
        setTimeout(() => {
            if(stopTracing) stopTracing()
            if(trail) trail.clear()
            animationStopped = true
        }, 550)
    }

    return animation
}
// Utilitary function for getting the progress including easing
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

type TraceEffectOptions = {
    /** Stroke color of the trace path @default "black" */
    stroke?: string
    /** Stroke width of the trace path @default "0.5px" */
    strokeWidth?: string
    /** Stroke opacity of the trace path @default "1" */
    strokeOpacity?: string
    /** Dash array pattern for the stroke */
    strokeDasharray?: string
    /** Dash offset for the stroke */
    strokeDashoffset?: string
}

export class TraceEffect {
    private container: HTMLElement
    private svg: SVGElement
    private path: SVGPolylineElement
    private points: Array<[number, number]> = []
    private options: TraceEffectOptions

    constructor(container: HTMLElement, options: TraceEffectOptions = {}) {
        this.container = container
        this.options = options

        // Remove existing trace if any
        const previousSVG = this.container.querySelector(".animation-trace")
        if (previousSVG) this.container.removeChild(previousSVG)

        // Create SVG container
        this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        this.svg.setAttribute("xmlns", "http://www.w3.org/2000/svg")
        this.svg.setAttribute("viewBox", "0 0 100 100")
        this.svg.setAttribute("width", "100%")
        this.svg.setAttribute("height", "100%")
        this.svg.classList.add("animation-trace")
        this.svg.style.position = 'absolute'
        this.svg.style.top = '0'
        this.svg.style.left = '0'
        this.svg.style.pointerEvents = 'none'
        this.svg.setAttribute('preserveAspectRatio', 'none')
        
        this.container.appendChild(this.svg)
        
        // Create polyline path
        this.path = document.createElementNS("http://www.w3.org/2000/svg", "polyline")
        this.path.setAttribute("fill", "none")
        this.path.setAttribute("stroke", this.options.stroke ?? "black")
        this.path.setAttribute("stroke-width", this.options.strokeWidth ?? "0.5px")
        this.path.setAttribute("stroke-opacity", this.options.strokeOpacity ?? "1")
        if (this.options.strokeDasharray) this.path.setAttribute("stroke-dasharray", this.options.strokeDasharray)
        if (this.options.strokeDashoffset) this.path.setAttribute("stroke-dashoffset", this.options.strokeDashoffset)
        this.path.setAttribute("stroke-linejoin", "round")
        this.path.setAttribute("stroke-linecap", "round")
        this.svg.appendChild(this.path)
    }

    /**
     * Adds a point to the trace path
     * @param x - X coordinate (0-100 range, mapped to SVG percentage)
     * @param y - Y coordinate (0-100 range, mapped to SVG percentage)
     */
    addPoint(x: number, y: number) {
        this.points.push([x, y])
        const pointsString = this.points.map(p => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join(' ')
        this.path.setAttribute("points", pointsString)
    }

    /**
     * Clears all points from the trace
     */
    clearPoints() {
        this.points = []
        this.path.setAttribute("points", "")
    }

    /**
     * Starts tracing the animation path
     * @param animation - The Web Animation API animation object
     * @param duration - Duration of the animation in seconds
     * @param points - Array of normalized points [x, y] from the animation
     * @param easing - Easing function name
     * @param getCanvasRect - Function that returns the canvas dimensions for coordinate conversion
     * @param onFrame - Optional callback when a new point is added
     * @returns A function to stop the tracing
     */
    startTracing(
        animation: Animation,
        duration: number,
        points: Array<[number, number]>,
        easing: string,
        onRefresh?: (point: [number, number], frame: number) => void,
        onFrame?: (point: [number, number], frame: number) => void,
    ): () => void {
        let startTime: number | null = null
        let lastFrame: number | null = null
        let animationStopped = false
        let rafId: number

        const stopTracing = () => {
            animationStopped = true
            if (rafId) cancelAnimationFrame(rafId)
        }

        const drawPath = (timestamp: number) => {
            if (animationStopped) return

            if (!startTime) startTime = timestamp

            const currentTime = parseFloat(animation.currentTime!.toString())
            const linearProgress = Math.min(1, currentTime / (duration * 1000))
            const easedProgress = getEasedProgress(linearProgress, easing)
            
            const currentFrame = Math.floor(easedProgress * (points.length - 1))
            const point = points.at(currentFrame)

            if (point) {
                if (currentFrame !== lastFrame) {
                    // Convert to SVG percentage coordinates (0-100)
                    this.addPoint(point[0] * 100, (1 - point[1]) * 100)
                    
                    if (onFrame) {
                        onFrame(point, currentFrame)
                    }

                    lastFrame = currentFrame
                }  
            } 
            if(onRefresh) onRefresh(point ?? points.at(-1)!, currentFrame)
            rafId = requestAnimationFrame(drawPath)
        }
        
        rafId = requestAnimationFrame(drawPath)
        return stopTracing
    }

    /**
     * Removes the trace SVG from the DOM
     */
    clear() {
        if (this.svg && this.svg.parentElement) {
            this.svg.parentElement.removeChild(this.svg)
        }
    }

    /**
     * Gets the current points array
     * @returns Array of points in the trace
     */
    getPoints(): Array<[number, number]> {
        return [...this.points]
    }

    /**
     * Sets the stroke style dynamically
     */
    setStrokeStyle(style: Partial<TraceEffectOptions>) {
        if (style.stroke) this.path.setAttribute("stroke", style.stroke)
        if (style.strokeWidth) this.path.setAttribute("stroke-width", style.strokeWidth)
        if (style.strokeOpacity) this.path.setAttribute("stroke-opacity", style.strokeOpacity)
        if (style.strokeDasharray) this.path.setAttribute("stroke-dasharray", style.strokeDasharray)
        if (style.strokeDashoffset) this.path.setAttribute("stroke-dashoffset", style.strokeDashoffset)
    }
}

/**
 * Configuration options for the TrailEffect animation
 * @property {number} [maxLength=30] - Maximum number of points in the trail. Higher values create longer trails.
 * @property {number} [decay=0.05] - Rate at which trail points fade away. Higher values = faster disappearance.
 * @property {Function} [ageFactor] - Function that determines the age factor based on trail progress.
 *   @param {number} progress - Current position in the trail (0 = newest, 1 = oldest)
 *   @returns {number} Age factor value used by other gradients
 * @property {Function} [opacityGradient] - Function that determines stroke opacity at each trail segment.
 *   @param {number} ageFactor - Value calculated by ageFactor(progress)
 *   @returns {number} Opacity value between 0 and 1
 * @property {Function} [lineWidthGradient] - Function that determines stroke width at each trail segment.
 *   @param {number} progress - Current position in the trail (0 = newest, 1 = oldest)
 *   @returns {number} Width of the line in pixels
 * @property {Function} [hueGradient] - Function that determines the hue color value at each trail segment.
 *   @param {number} progress - Current position in the trail (0 = newest, 1 = oldest)
 *   @returns {number} Hue value (0-360 degrees on color wheel)
 * @property {Function} [saturationGradient] - Function that determines color saturation at each trail segment.
 *   @param {number} progress - Current position in the trail (0 = newest, 1 = oldest)
 *   @returns {number} Saturation percentage (0-100)
 * @property {Function} [lightnessGradient] - Function that determines color lightness at each trail segment.
 *   @param {number} progress - Current position in the trail (0 = newest, 1 = oldest)
 *   @returns {number} Lightness percentage (0-100)
 * @property {string} [linecap="round"] - Style of line endings for trail segments.
 *   @type {"round" | "butt" | "square"}
 */
type TrailEffectOptions = {
    /** Maximum number of points in the trail. Higher values create longer trails. @default 30 */
    maxLength?: number,
    /** Rate at which trail points fade away. Higher values = faster disappearance. @default 0.05 */
    decay?: number,
    /** Function that determines the age factor based on trail progress. 
     * @param progress - Current position in the trail (0 = newest, 1 = oldest) 
     * @returns Age factor value used by other gradients */
    ageFactor?: (progress: number) => number
    /** Function that determines stroke opacity at each trail segment. 
     * @param ageFactor - Value calculated by ageFactor(progress) 
     * @returns Opacity value between 0 and 1 */
    opacityGradient?: (ageFactor: number) => number
    /** Function that determines stroke width at each trail segment. 
     * @param progress - Current position in the trail (0 = newest, 1 = oldest) 
     * @returns Width of the line in pixels */
    lineWidthGradient?: (progress: number) => number
    /** Function that determines the hue color value at each trail segment. 
     * @param progress - Current position in the trail (0 = newest, 1 = oldest) 
     * @returns Hue value (0-360 degrees on color wheel) */
    hueGradient?: (progress: number) => number
    /** Function that determines color saturation at each trail segment.
     * @param progress - Current position in the trail (0 = newest, 1 = oldest) 
     * @returns Saturation percentage (0-100) */
    saturationGradient?: (progress: number) => number
    /** Function that determines color lightness at each trail segment. 
     * @param progress - Current position in the trail (0 = newest, 1 = oldest) 
     * @returns Lightness percentage (0-100) */
    lightnessGradient?: (progress: number) => number
    /** Style of line endings for trail segments. */
    linecap?: "round" | "butt" | "square" 
}


/**
 * Creates a trailing visual effect that follows an HTML element, 
 * somewhat like a traveling star
 * @class
 * @example
 * const container = document.getElementById('animation-container');
 * const target = document.getElementById('moving-element');
 * const trail = new TrailEffect(container, target, {
 *   maxLength: 50,
 *   decay: 0.03,
 *   lineWidthGradient: (p) => 20 - p * 15,
 *   hueGradient: (p) => 200 + p * 100
 * });
 * 
 * // Update trail position each frame
 * const rect = target.getBoundingClientRect();
 * trail.addPoint(rect.left + rect.width/2, rect.top + rect.height/2);

*/
export class TrailEffect {
    /** Configuration options for the trail effect */
    options: TrailEffectOptions
    private parent
    private canvas: HTMLCanvasElement
    private followedElement: HTMLElement | undefined
    private ctx: CanvasRenderingContext2D
    private trail: Array<{x: number, y: number, age: number}> = []
    private maxLength
    private margin = 15



    setMargin(value: number) {
        if (value < 0) this.margin = 0
        this.margin = value

        this.canvas.style.top = `-${this.margin/2}%`
        this.canvas.style.left = `-${this.margin/2}%`
        this.canvas.style.width = `${100+this.margin}%`        
        this.canvas.style.height = `${100+this.margin}%`

        this.canvas.width = this.parent.clientWidth*(1+this.margin/100)  
        this.canvas.height = this.parent.clientHeight*(1+this.margin/100) 
    }

    /**
     * Gets the effective dimensions of the canvas accounting for margin
     * @returns  Canvas rectangle dimensions
     */
    getCanvasRect = (): {width: number, height: number} => {
        const rect = { width: this.canvas.width, height: this.canvas.height}
        rect.width = rect.width - this.parent.clientWidth*(this.margin/100)
        rect.height = rect.height - this.parent.clientHeight*(this.margin/100)

        return rect
    }

    /**
     * Creates a new TrailEffect instance
     * @param parent - Container element that holds the trail canvas
     * @param followedElement - Element whose position the trail follow
     */
    constructor(parent: HTMLElement, followedElement?: HTMLElement, options: TrailEffectOptions = {}) {
        this.options = options

        this.canvas = document.createElement('canvas')
        this.canvas.classList.add("animation-trail")
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
        
        this.maxLength = options.maxLength || 30

        this.parent = parent
        
        this.followedElement = followedElement

        // Adapter la taille au redimensionnement
        window.addEventListener('resize', () => {
            this.canvas.width = parent.clientWidth*(1+this.margin/100)  
            this.canvas.height = parent.clientHeight*(1+this.margin/100) 
        })
    }
    /**
     * Adds a new point to the trail and triggers a redraw
     * @param {number} x - X coordinate of the point (relative to parent container)
     * @param {number} y - Y coordinate of the point (relative to parent container)
     */
    addPoint(x?: number, y?: number) {
        if(typeof x !== "number" || typeof y !== "number") {
            if(!this.followedElement) throw new Error("addPoint() has been called without arguments but no followed element was specified.")
            x = this.followedElement.offsetLeft
            y = this.followedElement.offsetTop  + this.followedElement.clientHeight       
        }
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
        
        const elRect = this.followedElement?.getBoundingClientRect()
        const { 
                decay =  0.05,
                maxLength = 30,
                opacityGradient = (p) => Math.min(0.8, Math.pow(1 - p, 2) * 0.8),
                lineWidthGradient = (p) => elRect?.width ?? 20,
                hueGradient = (p) => 60 - p*95,
                saturationGradient = (p) => 100,
                lightnessGradient = (p) => 60 + p*45,
                linecap = "round"
            } = this.options
        // Dessiner la traînée lumineuse
        for (let i = 0; i < this.trail.length - 1; i++) {
            const p1 = this.trail[i]!
            const p2 = this.trail[i + 1]!
            
            const progress = i / this.trail.length

            const opacity = opacityGradient(progress)
        
            const lineWidth = lineWidthGradient(progress)
            
            // Dégradé de couleur (chaud → froid)
            const hue = hueGradient(progress)
            const saturation = saturationGradient(progress)
            const lightness = lightnessGradient(progress)
            
            this.ctx.beginPath()
            this.ctx.moveTo(p1.x, p1.y)
            this.ctx.lineTo(p2.x, p2.y)
            this.ctx.strokeStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity})`
            this.ctx.lineWidth = lineWidth
            this.ctx.lineCap = linecap 
            this.ctx.stroke()
        }
        
        // Décrémenter l'âge des points (effet fondu)
        this.trail = this.trail.map(p => ({ ...p, age: p.age - decay }))
            .filter(p => p.age > 0)
    }
    
    clear() {
        this.parent.removeChild(this.canvas)
    }
}