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
        //args.unshift(doc)
        args.push(function(err, val){
            if (prop){
                doc[prop] = val
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

var _exec = mongoose.Query.prototype.exec

mongoose.Query.prototype.exec = function (op, cb) {
    var __fills = this.__fills;
    console.log('query exec', this.options, 'this._conditions', this._conditions, this._fields)

    if (!__fills) {
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

    _exec.call(this, op, function (err, docs) {
        //var resolve = promise.resolve.bind(promise);

        if (err || !docs) {
            promise.resolve(err, docs);
            cb && cb(err, docs)
        } else {
            async.map(__fills, function(__fill, cb){

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
            def.fullMulty = cb
            return defFiller
        }
    }
    return defFiller
}

var addFills = function(__fills, Model, props, opts){

    props.split(' ').forEach(function(prop){
        var fill = Model.__fill[prop]
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
}


mongoose.Query.prototype.fill = function(props, opts) {

    var query = this;
    var Model = this.model;
    query.__fills = query.__fills || []

    addFills(query.__fills, Model, props, opts)

    return this
};

mongoose.Model.prototype.fill = function(prop, opts, cb) {

    var doc = this;
    var Model = this.constructor;

    var fill = Model.__fill[prop]

    if (typeof opts === 'function') {
        cb = opts;
        opts = undefined;
    }

    if(fill){
        fillDoc(doc, {props: [prop], fill: fill, opts: opts}, cb)
    } else {
        console.warn('No mongoose fill for', prop, 'found')
        cb(null, doc)
    }

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