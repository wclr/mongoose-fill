var mongoose = require('mongoose');
var async = require('async')
var util = require('util')

var fillDoc = function(doc, __fill, cb){

    var args = []

    if (__fill.opts !== undefined){
        args.push(__fill.opts)
    }

    if (__fill.fill.fill){
        args.unshift(doc)
        args.push(cb)
        __fill.fill.fill.apply(__fill.fill, args)
    } else if (__fill.fill.value) {
        var props = __fill.props,
            prop = props.length == 1 && props[0]

        var multipleProps = __fill.fill.props.length > 1

        //args.unshift(doc)
        args.push(function(err, val){
            if (prop){
                doc[prop] = multipleProps ? val[prop] : val
            } else {
                props.forEach(function(prop){
                    doc[prop] = val[prop]
                })
            }
            cb(err, doc)
        })
        __fill.fill.value.apply(doc, args)
    } else {
        cb(null, doc)
    }
}

var addFills = function(__fills, Model, props, opts){

    var added = false
    props.split(' ').forEach(function(prop){

        var fill = Model.__fill[prop]
        if (!fill){
            console.warn('mongoose-fill: fill for property', prop, 'not found')
            return
        }

        added = true
        fill.db = Model.db
        if (fill){
            // check if fill already added
            var __fill = __fills.filter(function(__f){return __f.fill == fill})[0]
            if (__fill){
                if (__fill.props.indexOf(prop) < 0){
                    __fill.props.push(prop)
                }
            } else {
                __fills.push({fill: fill, opts: opts, props: [prop]})
            }
        }
    })
    return added
}

var _exec = mongoose.Query.prototype.exec

mongoose.Query.prototype.exec = function (op, cb) {
    var __fills = this.__fills || [];
    //console.log('query exec', this.options, 'this._conditions', this._conditions, this._fields)

    var query = this

    if (query.model.__fill && this._fields){
        Object.keys(this._fields).forEach(function(f){
            if (query._fields[f] == 1 && query.model.__fill[f]){
                addFills(__fills, query.model, f)
            }
        })
    }

    if (!__fills.length) {
        return _exec.apply(this, arguments);
    }

    var promise = new mongoose.Promise();

    if (typeof op === 'function') {
        cb = op;
        op = null;
    }



    if (cb) {
        promise.onResolve(cb);
    }



    var __query = {
        conditions: this._conditions,
        fields: this._fields,
        options: this.options
    }

    __fills.forEach(function(__fill){

        if (__fill.fill.query){
            var result = __fill.fill.query.apply(query, [__query, function(){

            }])
            if (result !== undefined){
                __fill.executed = true
            }
        }
    })

    _exec.call(this, op, function (err, docs) {
        //var resolve = promise.resolve.bind(promise);

        if (err || !docs) {
            promise.resolve(err, docs);
            cb && cb(err, docs)
        } else {
            async.map(__fills, function(__fill, cb){
                if (__fill.executed){

                }
                // TODO: make this also if there is only multi methods when one doc
                if (util.isArray(docs)){
                    var args = []
                    if (__fill.opts !== undefined){
                        args.unshift(__fill.opts)
                    }
                    if (__fill.fill.multi){

                        var index = {},
                            ids = docs.map(function(doc){
                                index[doc._id.toString()] = doc
                                return doc._id
                            }, {})
                        args.unshift(ids)
                        // callback that fills props from result
                        //console.log('mongoose fill multi', __fill.props, ids.length)
                        args.push(function(err, results){

                            results && results.forEach(function(r){
                                var doc = index[r._id.toString()]
                                doc && __fill.props.forEach(function(prop){
                                    doc[prop] = r[prop]
                                })
                            })
                            //console.log('mongoose fill multi done', docs)
                            cb(err, docs)
                        })

                        __fill.fill.multi.apply(__fill.fill, args)
                        // TODO: add `full and fullMulti` API
                    } else if (__fill.fill.fullMulti){
                        __fill.fill.fullMulti(args)
                    } else {
                        async.map(docs, function(doc, cb){
                            fillDoc(doc, __fill, cb)
                        }, cb)
                    }
                } else {
                    fillDoc(docs, __fill, cb)
                }
            }, function(err){
                promise.resolve(err, docs);
            })
        }
    });

    return promise;
}

mongoose.Schema.prototype.fill = function(props, def) {

    this.statics.__fill = this.statics.__fill || {}

    def = def || {}

    if (typeof def == 'function') {
        def = {value: def}
    }

    var self = this

    props = props.split(' ')

    def.props = props

    props.forEach(function (prop) {
        self.statics.__fill[prop] = def

        self.virtual(prop).get(function () {
            return this['__' + prop]
        }).set(function (val) {
            this['__' + prop] = val
        })
    })

    var defFiller = {
        value: function(cb){
            def.value = cb
            return defFiller
        },
        full: function(cb){
            def.full = cb
            return defFiller
        },
        multi: function(cb){
            def.multi = cb
            return defFiller
        },
        fullMulti: function(cb){
            def.fullMulti = cb
            return defFiller
        },
        query: function(cb){
            def.query = cb
            return defFiller
        },

        debug: function(val){
            def.debug = val
            return defFiller
        }
    }

    defFiller.get = defFiller.value

    return defFiller
}


mongoose.Query.prototype.fill = function(props, opts) {

    var query = this;
    var Model = this.model;
    query.__fills = query.__fills || []

    addFills(query.__fills, Model, props, opts)

    return this
};

mongoose.Model.prototype.fill = function(props, opts, cb) {

    var doc = this;
    var Model = this.constructor;

    if (typeof opts === 'function') {
        cb = opts;
        opts = undefined;
    }

    var __fills = []

    addFills(__fills, Model, props, opts)

    async.map(__fills, function(__fill, cb){
        fillDoc(doc, __fill, cb)
    }, function(err){
        cb(err, doc)
    })

    return this
};

mongoose.Model.prototype.filled = function(prop, opts, cb){
    if (typeof opts === 'function') {
        cb = opts;
        opts = undefined;
    }

    this.fill(prop, opts, function(err, doc){
        cb(err, doc[prop])
    })
}

module.exports = mongoose