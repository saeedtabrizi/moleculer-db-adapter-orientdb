export type ExpressionType = 'BITWISE' | 'LOGICAL' | 'UNARY';
export type FilterExpression = string | Record<string, any>;
export type OpMapType = Record<string, { opCode: string; type: ExpressionType; prefix?: string }>;
const opMap: OpMapType = {
    $eq: { opCode: '=', type: 'BITWISE' },
    $ne: { opCode: '<>', type: 'BITWISE' },
    $gt: { opCode: '>', type: 'BITWISE' },
    $lt: { opCode: '<', type: 'BITWISE' },
    $gte: { opCode: '>=', type: 'BITWISE' },
    $lte: { opCode: '<=', type: 'BITWISE' },
    $or: { opCode: 'OR', type: 'LOGICAL' },
    $and: { opCode: 'AND', type: 'LOGICAL' },
    $nor: { opCode: 'OR', type: 'LOGICAL', prefix: '$not' },
    $not: { opCode: 'NOT', type: 'UNARY' },
    $in: { opCode: 'IN', type: 'BITWISE' },
    $nin: { opCode: 'NOT IN', type: 'BITWISE' },
    $exists: { opCode: 'IN', type: 'BITWISE' },
    $like: { opCode: 'LIKE', type: 'BITWISE' },
    $text: { opCode: 'CONTAINSTEXT', type: 'BITWISE' },
    $regex: { opCode: 'MATCHES', type: 'BITWISE' },
};

function buildStatementFromExpression(filter: FilterExpression, pkey?: string): string {
    if (!filter) return '';
    if (typeof filter !== 'object') {
        if (!pkey) {
            return String(filter);
        } else {
            const op = opMap[pkey];
            const srhs = typeof filter === 'string' ? `'${filter}'` : String(filter);
            return `${op.opCode} ${srhs}`;
        }
    }

    const r = [];
    if (!Array.isArray(filter)) {
        for (const lhs in filter) {
            if (filter.hasOwnProperty(lhs)) {
                const rhs = filter[lhs];
                if (lhs.startsWith('$')) {
                    if (Array.isArray(rhs) && ['$or', '$and', '$nor'].includes(lhs)) {
                        const op = opMap[lhs];
                        if (r.length >= 1) {
                            r.push(` AND `);
                        }
                        if (r.length === 0 && lhs === '$nor') {
                            const cop = opMap[op.prefix];
                            r.push(` ${cop.opCode} `);
                        }
                        r.push(`(`);
                        for (const item of rhs) {
                            r.push(buildStatementFromExpression(item, lhs));
                            r.push(` ${op.opCode} `);
                        }
                        r.pop();
                        r.push(`)`);
                    } else {
                        r.push(buildStatementFromExpression(rhs, lhs));
                    }
                } else {
                    const op = opMap[pkey || '$eq'];
                    let z = '';

                    if (op.type === 'BITWISE') {
                        if (r.length >= 1) {
                            r.push(` AND `);
                        }
                        if (typeof rhs === 'object') {
                            const srhs = buildStatementFromExpression(rhs);
                            z = `${lhs} ${srhs}`;
                        } else {
                            const srhs = typeof rhs === 'string' ? `'${rhs}'` : String(rhs);
                            z = `${lhs} ${op.opCode} ${srhs}`;
                        }

                        r.push(z);
                    } else if (op.type === 'LOGICAL') {
                        if (r.length >= 1) {
                            r.push(`${op.opCode} `);
                        }
                        z = `${buildStatementFromExpression({ [lhs]: rhs })}`;
                        r.push(`${z} `);
                    } else if (op.type === 'UNARY') {
                        z = `${op.opCode} ${buildStatementFromExpression({
                            [lhs]: rhs,
                        })}`;
                        r.push(z);
                    }
                }
            }
        }
    } else {
        if (pkey) {
            const items = [];
            const op = opMap[pkey];
            for (const item of filter) {
                items.push(typeof item === 'string' ? `'${item}'` : String(item));
            }
            const ss = '[' + items.join(' , ') + ']';
            const z = `${op.opCode} ${ss}`;
            r.push(z);
        } else {
            console.log('NOT IMPLEMENTED QUERY CONDITION');
            // r.push(z);
        }
    }
    const s = r.join(` `);
    return s;
}
export function getQueryFromFilterExpression(filter: FilterExpression): string {
    if (typeof filter === 'string') return filter;
    const s = buildStatementFromExpression(filter);
    return s;
}
