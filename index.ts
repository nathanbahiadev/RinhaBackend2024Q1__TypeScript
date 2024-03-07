import { fastify } from 'fastify'
import { Pool,  } from 'postgres-pool'

class Cliente {
    constructor(
        public limite: number = 0,
        public saldo: number = 0,
    ) {}
}

class Transacao {
    constructor(
        public valor: number = 0,
        public tipo: string = "",
        public descricao: string = "",
    ){}

    transacaoValida(): boolean {
        if (!['c', 'd'].includes(this.tipo)) {
            return false
        }

        if (this.valor <= 0) {
            return false
        }

        if (this.valor % 1 !== 0) {
            return false
        }

        if (
            !this.descricao ||
            this.descricao.length === 0 || 
            this.descricao.length > 10
        ) {
            return false
        }

        return true
    }
}

class Extrato {
    constructor(
        public saldo: {
            limite: number,
            total: number
        },
        public ultimas_transacoes: {
            valor: number
            tipo: string
            descricao: string
            realizada_em: string
        }[] = []
    ){}
}


const app = fastify({ logger: true })
const pool = new Pool({
    connectionString: "postgres://myuser:mypassword@localhost:5432/mydatabase"
})


app.get("/clientes/:id/extrato", async (req, res) => {
    try {
        const idCliente = (req.params as any).id
        const resultado = await pool.query(`SELECT * FROM GET_BALANCE(${idCliente});`)

        if (!resultado.rowCount) {
            res.code(404).send()
        }

        const extrato = new Extrato({
            limite: resultado.rows[0]["account_limit"],
            total: resultado.rows[0]["balance"],
        })

        if (resultado.rows[0]["value"])
            resultado.rows.forEach(row => {
                extrato.ultimas_transacoes.push({
                    valor: row["value"],
                    tipo: row["type"],
                    descricao: row["description"],
                    realizada_em: row["created_at"],
                })
            })

        return extrato
    }
    catch (err) {
        if (err instanceof Error)
            if (err.message === "CLIENT_NOT_FOUND") {
                res.code(404).send()
                return
            }

        res.code(500).send()
    }
})


app.post("/clientes/:id/transacoes", async (req, res) => {
    try {
        const idCliente = (req.params as any).id
        const json = req.body as any
        const payload = {
            valor: json.valor as number, 
            tipo: json.tipo as string, 
            descricao: json.descricao as string
        }

        const transacao = new Transacao(payload.valor, payload.tipo, payload.descricao)

        if (!transacao.transacaoValida()) {
            res.code(422).send()
            return
        }
    
        const resultado = await pool.query(`SELECT * FROM CREATE_TRANSACTION(
            ${idCliente},
            ${transacao.valor},
            '${transacao.tipo}',
            '${transacao.descricao}'
        )`)
    
        const cliente: Cliente = {
            saldo: resultado.rows[0]["b"],
            limite: resultado.rows[0]["l"],
        }
    
        return cliente
        
    } catch (err) {
        if (err instanceof Error) {
            if (err.message === "LOW_LIMIT") {
                res.code(422).send()
                return
            } 

            if (err.message === "CLIENT_NOT_FOUND") {
                res.code(404).send()
                return
            }
        }

        res.code(500).send()
    }
})


const start = async () => {
    const porta = parseInt(process.env.PORT || '3000')

    await app.listen({
        port: porta,
    })
}

start()