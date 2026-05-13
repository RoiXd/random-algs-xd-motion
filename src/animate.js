export function fn2Animation(element, fn, range, fps, duration, options = {}) {
    const { easing = "linear", scale=null } = options
    const norm = 1/Math.abs(Math.max(...range) - Math.min(...range))


    const points = []


    const dx = Math.abs(Math.max(...range) - Math.min(...range))/(fps*duration)

    // Building all points
    for(let i = Math.min(...range); i < Math.max(...range); i += dx) {
        points.push(scale ? [i*scale, fn(i)*scale] : [i*norm + 0.5, fn(i+0.5)*norm])
    }

    // Appending them to an animation
    return element.animate(points.map(pt => {
        console.log(`(${`${pt[0]*100}%`}, ${`${pt[1]*100}%`})`);
        
        const point = scale ? {left: `${pt[0]}px`, bottom: `${pt[1]}px`} : 
            { left: `${pt[0]*100}%`, bottom: `${pt[1]*100}%`}

        return point
    }),
    {
        duration: duration*1000,
        easing: easing,
        iterations: 1
    })
}