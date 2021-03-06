'use strict';

const Hapi = require('@hapi/hapi');
const Code = require('@hapi/code');
const Lab = require('@hapi/lab');
const Lib = require('..');
const Methods = require('./methods');
const Schemas = require('./schemas');
const Testlib = require('./testlib');

const expect = Code.expect;
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;

const connString = 'postgres://postgres:postgres@localhost:5432/postgres';

const timeout = (ms) => {

    return new Promise((res) => {

        return setTimeout(res, ms);
    });
};

describe('lib', () => {

    it('exports.initBookshelf', () => {

        const bsString = Lib.initBookshelf(connString);
        const bsPlugin = Lib.initBookshelf(connString, ['registry', 'pagination', 'visibility']);
        const bsKnex = Lib.initBookshelf(require('knex')(connString));
        const bsBookshelf = Lib.initBookshelf(require('bookshelf')(require('knex')(connString)));

        expect(bsString.knex).to.exist();
        expect(bsPlugin.knex).to.exist();
        expect(bsKnex.knex).to.exist();
        expect(bsBookshelf.knex).to.exist();

        expect(() => {

            Lib.initBookshelf({});
        }).to.throw(Error, 'unable to instantiate bookshelf, invalid parameter');
    });

    it('exports.initConns', () => {

        const oakb = Lib.initConns(connString);
        const oakt = Lib.initConns({ test: connString });

        expect(oakb.bookshelves.default.knex).to.exist();
        expect(oakb.knexes.default.raw).to.exist();
        expect(oakt.bookshelves.test.knex).to.exist();
        expect(oakt.knexes.test.raw).to.exist();

        expect(() => {

            Lib.initConns(0);
        }).to.throw(Error, 'unable to instantiate bookshelves, invalid connections');
    });

    it('exports.createTable', async () => {

        const knex = Lib.initConns(connString).knexes.default;

        const Model1 = Object.assign({}, Schemas[0]);
        const Model2 = Object.assign({}, Schemas[1]);

        const hasTable = async (model) => {

            const hasTable = await knex.schema.hasTable(model.protoProps.tableName);

            await knex.schema.dropTableIfExists(model.protoProps.tableName);

            return hasTable;
        };

        await hasTable(Model1);
        await hasTable(Model2);

        await Lib.createTable(Model1, knex);
        await Lib.createTable(Model1, knex);

        expect(await hasTable(Model1)).to.be.true();

        await Lib.createTable(Model1, knex);

        expect(await hasTable(Model1)).to.be.true();

        await Lib.createTable(Model1, Lib.initConns(connString).bookshelves.default);

        expect(await hasTable(Model1)).to.be.true();

        Model1.knex = knex;

        await Lib.createTable(Model1);

        expect(await hasTable(Model1)).to.be.true();

        Model1.columns = null;
        Model1.constraints = null;

        await Lib.createTable(Model1, knex, {
            columns: (table) => {

                table.string('unique');
            },
            constraints: (table) => {

                table.unique('unique');
            }
        });

        expect(await hasTable(Model1)).to.be.true();

        await Lib.createTable(Model2, knex);

        expect(await hasTable(Model2)).to.be.true();

        Model2.raw = `ALTER TABLE public.${Model2.protoProps.tableName} ADD column rawtest text`;

        await Lib.createTable(Model2, knex);

        expect(await hasTable(Model2)).to.be.true();
    });

    it('exports.loadModel', async () => {

        const bookshelf = Lib.initConns(connString).bookshelves.default;

        const Model0 = Object.assign({}, Schemas[0]);
        const Model1 = Object.assign({}, Schemas[0]);
        const Model3 = Object.assign({}, Schemas[2]);
        const Model4 = Object.assign({}, Schemas[3]);
        const Model5 = Object.assign({}, Schemas[4]);
        const Model6 = Object.assign({}, Schemas[5]);

        await bookshelf.knex.schema.dropTableIfExists(Model4.protoProps.tableName);
        await bookshelf.knex.schema.dropTableIfExists(Model3.protoProps.tableName);
        await bookshelf.knex.schema.dropTableIfExists(Model1.protoProps.tableName);
        await bookshelf.knex.schema.dropTableIfExists(Model5.protoProps.tableName);
        await bookshelf.knex.schema.dropTableIfExists(Model6.protoProps.tableName);

        await Lib.createTable(Model3, bookshelf);
        await Lib.createTable(Model4, bookshelf);
        await Lib.createTable(Model1, bookshelf);
        await Lib.createTable(Model5, bookshelf);
        await Lib.createTable(Model6, bookshelf);

        const soloTable = Lib.loadModel(Model1, bookshelf);
        const bookModel = Lib.loadModel(Model4, bookshelf);
        const authorModel = Lib.loadModel(Model3, bookshelf);
        const updatedModel = Lib.loadModel(Model6, bookshelf);
        const formatterModel = Lib.loadModel(Model5, bookshelf);

        await updatedModel.do.create({ label: 'updateme' });

        expect(authorModel.do.testing()).to.equal('author');

        Model0.name = 'soloTablex';
        Model0.protoProps.tableName = 'solo_table_x';
        Model0.bookshelf = bookshelf;

        Lib.loadModel(Model0);

        let res;

        expect(await soloTable.do.browse({
            perPage: 2,
            page: 2
        })).to.equal([]);

        expect(await soloTable.do.browse({
            perPage: 2,
            page: 2,
            custom: (query) => {

                query.orderByRaw('id DESC');
            }
        })).to.equal([]);

        expect(await soloTable.do.browse({
            perPage: 2,
            custom: (query) => {

                query.orderByRaw('id DESC');
            }
        })).to.equal([]);

        expect(await soloTable.do.browse({
            custom: (query) => {

                query.orderByRaw('id DESC');
            }
        })).to.equal([]);

        expect(await soloTable.do.browse()).to.equal([]);

        expect(await soloTable.do.obtain()).to.equal(null);

        await soloTable.do.create({ label: 'test' });

        res = await soloTable.do.browse();

        expect(res[0].label).to.equal('test');

        await soloTable.do.update({ id: 1 }, { label: 'foobar' });

        res = await soloTable.do.browse();

        expect(res[0].label).to.equal('foobar');

        await expect(soloTable.do.delete()).to.reject(Error, 'No Rows Deleted');

        await expect(soloTable.do.delete({
            label: 'foobars'
        })).to.reject(Error, 'No Rows Deleted');

        await soloTable.do.delete({ label: 'foobar' });

        expect(await soloTable.do.browse()).to.equal([]);

        const author = await authorModel.do.create({ name: 'tolkien' });
        await bookModel.do.create({ author_id: author.id, title: 'the hobbit' });

        res = await authorModel.do.browse();

        expect(res[0].name).to.equal('tolkien');

        res = await bookModel.do.browse({ page: 1, perPage: 10 });

        expect(res[0].title).to.equal('the hobbit');

        const qb = bookModel.model.query();

        res = await qb.where({ id: 1 }).select();

        expect(res[0].title).to.equal('the hobbit');

        res = await bookModel.do.obtain({ id: 1 });

        expect(res.author.name).to.equal('tolkien');

        expect(await bookModel.do.obtain({ id: 3 })).to.equal(null);

        await bookModel.do.delete({ title: 'the hobbit' });
        await authorModel.do.delete({ id: 1 });

        expect(await bookModel.do.browse()).to.equal([]);

        await formatterModel.do.create();

        res = await formatterModel.do.browse({}, {
            formatter: async (query, schema) => {
                return { query, schema };
            }
        });

        expect(res[0].label).to.equal('fixed');

        expect(await formatterModel.do.browse()).to.equal([]);

        await formatterModel.do.create();

        res = await formatterModel.do.browse();

        expect(res[0].label).to.equal('fixed');

        await formatterModel.do.update({ id: 2 }, { label: 'foobar' });

        res = await formatterModel.do.browse();

        expect(res[0].label).to.equal('updated');

        res = await formatterModel.do.browse({}, {
            formatter: async (query, schema) => {
                return { query, schema };
            }
        });

        expect(res[0].label).to.equal('fixed');

        await expect(formatterModel.do.update()).to.reject(Error,
            'A model cannot be updated without a "where" clause or an idAttribute.');

        await expect(formatterModel.do.delete({
            label: 'foobar'
        })).to.reject(Error, 'No Rows Deleted');

        await expect(formatterModel.do.delete({
            id: 1
        })).to.reject(Error, 'No Rows Deleted');

        await expect(soloTable.do.create()).to.reject(Error,
            'insert into "solo_table" default values returning "id" - null value in column "label" violates not-null constraint');

        await timeout(1000);

        await updatedModel.do.update({ id: 1 }, { label: 'updated' });

        res = await updatedModel.do.browse();

        const delay = res[0].updated_at.getTime() - res[0].created_at.getTime();

        expect(delay).to.be.above(1000);
        expect(delay).to.be.below(2000);


        await bookshelf.knex.schema.dropTableIfExists(Model4.protoProps.tableName);
        await bookshelf.knex.schema.dropTableIfExists(Model3.protoProps.tableName);
        await bookshelf.knex.schema.dropTableIfExists(Model1.protoProps.tableName);
        await bookshelf.knex.schema.dropTableIfExists(Model5.protoProps.tableName);
        await bookshelf.knex.schema.dropTableIfExists(Model6.protoProps.tableName);

        expect(() => {

            Lib.loadModel(Model1);
        }).to.throw(Error, 'Bookshelf instance is invalid');

        expect(() => {

            Lib.loadModel(Model1, {});
        }).to.throw(Error, 'Bookshelf instance is invalid');
    });

    it('exports.buildShelf', async () => {

        const Modelx = Object.assign({}, Schemas[4], { protoProps: { tableName: 'formatter_tablex' } });
        const Model0 = Object.assign({}, Schemas[0], { name: 'book2' });
        const Models2 = [Model0];
        const shelf0 = await Lib.buildShelf(connString);
        const shelf = await Lib.buildShelf(connString, Schemas, { methods: [Methods] });
        const shelf2 = await Lib.buildShelf({ foobar: connString }, { foobar: Schemas });
        const shelf3 = await Lib.buildShelf({
            foobar: connString,
            barfoo: connString
        }, {
            foobar: Schemas,
            barfoo: Models2
        });

        const shelf4 = await Lib.buildShelf(connString, [Modelx], {
            schemas: {
                formatterTable: {
                    columns: (table) => {

                        table.string('somecolumn');
                    }
                }
            }
        });

        const shelf78 = await Lib.buildShelf(connString, [Schemas[7], Schemas[8]]);

        expect(shelf78.models.recurseReferenceTableA).to.exist();
        expect(shelf78.models.recurseReferenceTableB).to.exist();

        expect(shelf0.bookshelves.default.knex).to.exist();
        expect(shelf0.knexes.default.raw).to.exist();

        expect(await shelf.methods.testing()).to.equal('methodtestrowling');

        expect(shelf.bookshelves.default.knex).to.exist();
        expect(shelf.knexes.default.raw).to.exist();
        expect(shelf.models.soloTable.do).to.exist();
        expect(shelf.models.compositeTable.do).to.exist();
        expect(shelf.models.author.do).to.exist();
        expect(shelf.models.book.do).to.exist();

        expect(await shelf.models.book.do.browse()).to.equal([]);

        expect(shelf2.bookshelves.foobar.knex).to.exist();
        expect(shelf2.knexes.foobar.raw).to.exist();
        expect(shelf2.models.soloTable.do).to.exist();
        expect(shelf2.models.compositeTable.do).to.exist();
        expect(shelf2.models.author.do).to.exist();
        expect(shelf2.models.book.do).to.exist();

        expect(await shelf2.models.book.do.browse()).to.equal([]);

        expect(shelf3.bookshelves.foobar.knex).to.exist();
        expect(shelf3.knexes.foobar.raw).to.exist();
        expect(shelf3.models.soloTable.do).to.exist();
        expect(shelf3.models.compositeTable.do).to.exist();
        expect(shelf3.models.author.do).to.exist();
        expect(shelf3.models.book.do).to.exist();
        expect(shelf3.bookshelves.barfoo.knex).to.exist();
        expect(shelf3.knexes.barfoo.raw).to.exist();
        expect(shelf3.models.soloTable.do).to.exist();
        expect(shelf3.models.compositeTable.do).to.exist();
        expect(shelf3.models.author.do).to.exist();
        expect(shelf3.models.book.do).to.exist();

        expect(await shelf3.models.book2.do.browse()).to.equal([]);

        const res4 = await shelf4.models.formatterTable.do.create({ somecolumn: 'test' });

        expect(res4.somecolumn).to.equal('test');

        await shelf.bookshelves.default.knex.schema.dropTableIfExists(Modelx.protoProps.tableName);
        await shelf.bookshelves.default.knex.schema.dropTableIfExists(Schemas[4].protoProps.tableName);
        await shelf.bookshelves.default.knex.schema.dropTableIfExists(Schemas[3].protoProps.tableName);
        await shelf.bookshelves.default.knex.schema.dropTableIfExists(Schemas[2].protoProps.tableName);
        await shelf.bookshelves.default.knex.schema.dropTableIfExists(Schemas[1].protoProps.tableName);
        await shelf.bookshelves.default.knex.schema.dropTableIfExists(Schemas[0].protoProps.tableName);

        await expect(Lib.buildShelf({
            foobar: connString
        }, {
            foobarx: Schemas
        })).to.reject(Error, 'No bookshelf defined for: foobarx');
    });

    it('exports.generateHapiPlugin', async () => {

        const server = Hapi.server();
        const serverx = Hapi.server();
        const serverz = Hapi.server();
        const serverv = Hapi.server();
        const servery = Hapi.server();
        const serveru = Hapi.server();

        await serveru.register({
            plugin: Lib.generateHapiPlugin('../package.json'),
            options: { conns: connString }
        });

        await server.register({
            plugin: Lib.generateHapiPlugin('../package.json', Schemas),
            options: { conns: connString }
        });

        await serverz.register({
            plugin: Lib.generateHapiPlugin('../package.json', Schemas, { methods: [Methods] }),
            options: { conns: connString }
        });

        await servery.register({
            plugin: Lib.generateHapiPlugin('../package.json', Schemas, { methods: [Methods] }),
            options: {
                conns: connString,
                methods: [
                    () => {

                        return {
                            testingz: async () => {

                                return 'testingz';
                            }
                        };
                    }
                ]
            }
        });

        await serverx.register({
            plugin: Lib.generateHapiPlugin('../package.json', Schemas, {
                conns: connString,
                schemas: {
                    compositeTable: {
                        method: {
                            obtain: {
                                cache: {
                                    expiresIn: 2000,
                                    generateTimeout: 100
                                },
                                generateKey: (params, opts) => {

                                    return `${params}${opts}`;
                                }
                            }
                        }
                    }
                }
            })
        });

        expect(serveru.bookshelves.default.knex).to.exist();
        expect(serveru.knexes.default.raw).to.exist();

        const models = server.methods.models;
        const modelsx = serverx.methods.models;

        expect(models.soloTable.schema()).to.exist();

        await models.soloTable.do.create({ label: 'farboo' });

        let res = await models.soloTable.do.obtain({ id: 1 });

        expect(res.label).to.equal('farboo');

        res = await modelsx.soloTable.do.browse();

        expect(res[0].label).to.equal('farboo');

        await expect(serverv.register({
            plugin: Lib.generateHapiPlugin('../package.json', Schemas)
        })).to.reject(Error, 'Missing connections');

        await expect(models.soloTable.do.obtain({
            id: 2
        }, {
            require: true
        })).to.reject(Error, 'EmptyResponse');

        expect(await servery.methods.testingz()).to.equal('testingz');
        expect(await serverz.methods.testing()).to.equal('farboorowling');

        await server.knexes.default.schema.dropTableIfExists(Schemas[3].protoProps.tableName);
        await server.knexes.default.schema.dropTableIfExists(Schemas[2].protoProps.tableName);
        await server.knexes.default.schema.dropTableIfExists(Schemas[1].protoProps.tableName);
        await server.knexes.default.schema.dropTableIfExists(Schemas[0].protoProps.tableName);

        server.route({
            method: 'get',
            path: '/',
            handler: async (request) => {

                return request.server.methods.models.soloTable.schema().name;
            }
        });

        res = await server.inject('/');

        expect(res.result).to.equal('soloTable');
    });

    it('exports.generateShelf', async () => {

        const shelf = await Testlib.init(connString);

        expect(shelf.bookshelves.default.knex).to.exist();
        expect(shelf.knexes.default.raw).to.exist();
        expect(shelf.models.soloTable.do).to.exist();
        expect(shelf.models.compositeTable.do).to.exist();
        expect(shelf.models.author.do).to.exist();
        expect(shelf.models.book.do).to.exist();

        let res;

        expect(await shelf.models.book.do.browse()).to.equal([]);

        const server = Hapi.server();

        await server.register({
            plugin: Testlib,
            options: {
                conns: connString,
                schemas: {
                    author: {
                        method: {
                            obtain: {
                                cache: {
                                    expiresIn: 2000,
                                    generateTimeout: 100
                                },
                                generateKey: (params, opts) => {

                                    return `${params}${opts}`;
                                }
                            }
                        }
                    }
                }
            }
        });

        const models = server.methods.models;

        await models.soloTable.do.create({ label: 'farboo' });

        res = await models.soloTable.do.obtain({ id: 1 });

        expect(res.label).to.equal('farboo');

        res = await models.soloTable.do.browse();

        expect(res[0].label).to.equal('farboo');

        await shelf.bookshelves.default.knex.schema.dropTableIfExists(Schemas[3].protoProps.tableName);
        await shelf.bookshelves.default.knex.schema.dropTableIfExists(Schemas[2].protoProps.tableName);
        await shelf.bookshelves.default.knex.schema.dropTableIfExists(Schemas[1].protoProps.tableName);
        await shelf.bookshelves.default.knex.schema.dropTableIfExists(Schemas[0].protoProps.tableName);
    });
});
