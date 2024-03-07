"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = require("fastify");
const postgres_pool_1 = require("postgres-pool");
class Cliente {
    constructor(limite = 0, saldo = 0) {
        this.limite = limite;
        this.saldo = saldo;
    }
}
class Transacao {
    constructor(valor = 0, tipo = "", descricao = "") {
        this.valor = valor;
        this.tipo = tipo;
        this.descricao = descricao;
    }
    transacaoValida() {
        if (!['c', 'd'].includes(this.tipo)) {
            return false;
        }
        if (this.valor <= 0) {
            return false;
        }
        if (this.descricao.length === 0 || this.descricao.length > 10) {
            return false;
        }
        return true;
    }
}
class Extrato {
    constructor(saldo, ultimas_trasacoes = []) {
        this.saldo = saldo;
        this.ultimas_trasacoes = ultimas_trasacoes;
    }
}
const app = (0, fastify_1.fastify)({ logger: true });
const pool = new postgres_pool_1.Pool({
    connectionString: "postgres://myuser:mypassword@localhost:5432/mydatabase"
});
app.get("/clientes/:id/extrato", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const idCliente = req.params.id;
        const resultado = yield pool.query(`SELECT * FROM GET_BALANCE(${idCliente});`);
        const extrato = new Extrato({
            limite: resultado.rows[0]["account_limit"],
            total: resultado.rows[0]["balance"],
        });
        if (resultado.rows[0]["value"])
            resultado.rows.forEach(row => {
                extrato.ultimas_trasacoes.push({
                    valor: row["value"],
                    tipo: row["type"],
                    descricao: row["description"],
                    realizada_em: row["created_at"],
                });
            });
        return extrato;
    }
    catch (err) {
        if (err instanceof Error)
            if (err.message === "CLIENT_NOT_FOUND") {
                res.code(404).send();
                return;
            }
        res.code(500).send();
    }
}));
app.post("/clientes/:id/transacoes", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const idCliente = req.params.id;
        const json = req.body;
        const payload = {
            valor: json.valor,
            tipo: json.tipo,
            descricao: json.descricao
        };
        const transacao = new Transacao(payload.valor, payload.tipo, payload.descricao);
        if (!transacao.transacaoValida()) {
            res.code(422).send();
            return;
        }
        const resultado = yield pool.query(`SELECT * FROM CREATE_TRANSACTION(
            ${idCliente},
            ${transacao.valor},
            '${transacao.tipo}',
            '${transacao.descricao}'
        )`);
        const cliente = {
            saldo: resultado.rows[0]["b"],
            limite: resultado.rows[0]["l"],
        };
        return cliente;
    }
    catch (err) {
        if (err instanceof Error) {
            if (err.message === "LOW_LIMIT") {
                res.code(422).send();
                return;
            }
            if (err.message === "CLIENT_NOT_FOUND") {
                res.code(404).send();
                return;
            }
        }
        res.code(500).send();
    }
}));
const start = () => __awaiter(void 0, void 0, void 0, function* () {
    const porta = parseInt(process.env.PORT || '3000');
    yield app.listen({
        port: porta,
    });
});
start();
