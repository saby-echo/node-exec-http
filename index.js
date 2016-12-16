const http = require('http')
const Knex = require('knex')

const server = http.createServer()

server.on('request', (req, res) => {
    if (req.method !== 'POST' || req.url !== '/execute') {
        res.writeHead(404)
        res.end()
        return
    }

    let moduleBody = ''

    req.on('data', chunk => {
        moduleBody += chunk
    })

    req.on('error', error => {
        req.writeHead(500)
        res.end(JSON.stringify({
            message: error.message,
            stack: error.stack
        }, null, 4))
    })

    req.on('end', () => {
        runModule(moduleBody).then(response => {

            try {
                const json = JSON.stringify(response.data, (key, val) => val === null ? undefined : val, 0)
                res.writeHead(response.status, { 'Content-Type': 'application/json' })
                res.end(json)

            } catch (err) {
                res.writeHead(500)
                res.end('Cannot stringify result!')
            }
        })
    })
})

function executeModule(moduleBody) {
    const func = new Function('exports', 'require', 'module', moduleBody)
    const exports = {}
    const module = { exports: exports }
    func(exports, require, module)
    return module.exports
}

function runModule(moduleBody) {

    try {
        const moduleExports = executeModule(moduleBody)

        if (moduleExports == null || typeof moduleExports !== 'object' || typeof moduleExports.run !== 'function') {
            return Promise.resolve({ status: 400, data: 'Module should have "run" function exported!' })
        }

        const promise = moduleExports.run()

        if (promise == null || promise.then == null) {
            return Promise.resolve({ status: 400, data: '"module.run()" should return promise!' })
        }

        return promise
            .then(val => ({ status: 200, data: val }))
            .catch(err => ({
                status: 400, data: {
                    message: err.message,
                    stack: err.stack
                }
            }))
    } catch (err) {
        return Promise.resolve({
            status: 400, data: {
                message: err.message,
                stack: err.stack
            }
        })
    }
}

server.listen(3000, 'localhost', () => {
    console.log(`Listening on http://localhost:${server.address().port}`)
})
