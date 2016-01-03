/* global appGeoPro, $ */
'use strict';

// Create the es service from the esFactory
appGeoPro.service('es', function (esFactory, geoProConfig) {
	return esFactory({ 
		host: geoProConfig.elasticsearch.host,
		index: geoProConfig.elasticsearch.index
	});
});

/* Elasticsearch Service */
appGeoPro.factory('elasticService', function (es, geoProConfig) {
	// Données Elasticsearch
	var size_limit = 50,
		request_limit = 1000,
		activites_type_doc = "activites",
		communes_type_doc = "communes",
		referentiel_activites_type_doc = "referentiel_activites",
		referentiel_communes_type_doc = "referentiel_communes",
		activites_connexes_type_doc = "activites_connexes",
		etablissements_type_doc = "etablissements",
		commentaires_type_doc = "commentaires";

	var format_es_hits = function (response) {
			var data_item_list = {
				data: []
			};
			if (response.hits) {
				response.hits.hits.forEach(function (res) {
					res._source._id = res._id;
					data_item_list.data.push(res._source);
				});
			}

			return data_item_list;
		},
		format_es_mget = function (response) {
			var data_item_list = [];
			response.docs.forEach(function (doc) {
				var data_item = {};
				if (doc.found) {
					data_item = doc._source;
				}
				data_item_list.push(data_item);
			});

			return {'data': data_item_list};
		};

	return {
		/* Référentiel Activités */
		get_all_ref_activites: function (filter, callback) {
			var body_query = {
					"query": {
						"filtered": {
							"query": {},
							"filter": {
								"and" : {
									"filters": []
								}
							}
						}
					}
				};

			if (filter) {
				body_query.query.filtered.query = {
					"query_string": {
						"query": "*" + filter.replace(" ", "\\ ") + "*",
						"fields": ["code_rubrique", "activite"] 
					}
				};
			} else {
				body_query.query.filtered.query = {"match_all": {}};
			}

			es.search({
				index: geoProConfig.elasticsearch.index,
				size: size_limit,
				type: referentiel_activites_type_doc,
				body: body_query
			}).then(function (response) {
				var data = format_es_hits(response);
				callback(data);
			}, function (err) {
				console.log(err.message);
			});
		},
		get_ref_activite_by_code: function (code, callback) {
			es.search({
				index: geoProConfig.elasticsearch.index,
				size: size_limit,
				type: referentiel_activites_type_doc,
				body: {
					"query" : {
						"filtered" : {
							"query" : {
								"match" : {
									"code_rubrique" : code
								}
							}
						}
					}
				}
			}, function (error, response) {
				var data = (!error && response) ? format_es_hits(response) : null;
				callback(data);
			});
		},
		/* Référentiel Communes */
		get_all_ref_communes: function (filter, callback) {
			var body_query = {
					"query": {
						"filtered": {
							"query": {},
							"filter": {
								"and" : {
									"filters": []
								}
							}
						}
					}
				};

			if (filter) {
				body_query.query.filtered.query = {
					"query_string": {
						"query": "*" + filter.replace(" ", "\\ ") + "*",
						"fields": ["libelle", "code_commune"] 
					}
				};
			} else {
				body_query.query.filtered.query = {"match_all": {}};
			}

			es.search({
				index: geoProConfig.elasticsearch.index,
				size: size_limit,
				type: referentiel_communes_type_doc,
				body: body_query
			}).then(function (response) {
				var data = format_es_hits(response);
				callback(data);
			}, function (err) {
				console.log(err.message);
			});
		},
		/* Communes */
		get_all_bounded_communes : function (map_bounds, callback) {
			var body_query = {
					"filter": {
						"geo_shape": {
							"geometry": {
								"shape": {
									"type": "envelope",
									"coordinates": [
										[map_bounds.top_right.lng, map_bounds.top_right.lat], 
										[map_bounds.bottom_left.lng, map_bounds.bottom_left.lat]
									]
								}
							}
						}
					}
				};
			es.search({
				index: geoProConfig.elasticsearch.index,
				size: 5000,
				type: communes_type_doc,
				body: body_query
			}).then(function (response) {
				var data = format_es_hits(response);
				callback(data);
			});
		},
		/* Activités Connexes */
		get_activite_connexe_by_activite_code: function (code, callback) {
			es.search({
				index: geoProConfig.elasticsearch.index,
				size: size_limit,
				type: activites_connexes_type_doc,
				body: {
					"query" : {
						"filtered" : {
							"query" : {
								"match" : {
									"rubrique_src.code_rubrique" : code
								}
							}
						}
					}
				}
			}).then(function (response) {
				var data = format_es_hits(response);
				callback(data);
			});
		},
		get_activite_by_activite_connexe_code: function (code, callback) {
			es.search({
				index: geoProConfig.elasticsearch.index,
				size: size_limit,
				type: activites_connexes_type_doc,
				body: {
					"query" : {
						"filtered" : {
							"query" : {
								"match" : {
									"rubrique_connexe.code_rubrique" : code
								}
							}
						}
					}
				}
			}).then(function (response) {
				var data = format_es_hits(response);
				callback(data);
			});
		},
		/* Activités */
		get_activites_by_code: function (code, callback) {
			es.search({
				index: geoProConfig.elasticsearch.index,
				size: size_limit,
				type: activites_type_doc,
				body: {
					"query" : {
						"filtered" : {
							"filter" : {
								"limit" : {
									"value" : request_limit
								}
							},
							"query" : {
								"match" : {
									"code_activite" : code
								}
							}
						}
					}
				}
			}).then(function (response) {
				var data = format_es_hits(response);
				callback(data);
			});
		},
		get_activites_by_localite: function (code, callback) {
			es.search({
				index: geoProConfig.elasticsearch.index,
				size: size_limit,
				type: activites_type_doc,
				body: {
					"query" : {
						"filtered" : {
							"query" : {
								"match" : {
									"no_localite" : code
								}
							}
						}
					}
				}
			}).then(function (response) {
				var data = format_es_hits(response);
				callback(data);
			});
		},
		get_bounded_localites_with_activite: function (code, map_bounds, callback) {
			var body_query_v1 = {
					"filter": {
						"and": {
						   "filters": [
							  {
								  "term": {
									 "code_activite": code
								  }
							  },
							  {
								 "geo_shape": {
									"commune.geometry": {
									   "shape": {
										  "type": "envelope",
										  "coordinates": [
											 [map_bounds.top_right.lng, map_bounds.top_right.lat], 
											 [map_bounds.bottom_left.lng, map_bounds.bottom_left.lat]
										  ]
									   }
									}
								 }
							  }
						   ]
						}
					}
				};
				// body_query_v2 = {
				// 	"query" : {
				// 		"bool" : {
				// 			"must": {
				// 				"match": {
				// 					"code": code
				// 				}
				// 			},
				// 			"filter": {
				// 				"geo_shape": {
				// 					"commune.geometry": {
				// 						"shape": {
				// 							"type": "envelope",
				// 							"coordinates" : [
				// 								[map_bounds.top_right.lng, map_bounds.top_right.lat], 
				// 								[map_bounds.bottom_left.lng, map_bounds.bottom_left.lat]
				// 							]
				// 						}
				// 					}
				// 				}
				// 			}
				// 		}
				// 	}
				// };
			es.search({
				index: geoProConfig.elasticsearch.index,
				size: 5000,
				type: activites_type_doc,
				body: body_query_v1
			}).then(function (response) {
				var data = format_es_hits(response);
				callback(data);
			});
		},
		get_activite_by_code_and_localite: function (code, localite, callback) {
			var body_query = {
				"query" : {
					"filtered" : {
						"query": {
							"match_all": {}
						},
						"filter": {
							"and": {
								"filters": [
									{
										"query": {
											"match": {
												"code_activite": code
											}
										}
									},
									{
										"query": {
											"match": {
												"commune.code_commune": localite
											}
										}
									}
								]
							}
						}
					}
				}
			};
			es.search({
				index: geoProConfig.elasticsearch.index,
				size: size_limit,
				type: activites_type_doc,
				body: body_query
			}).then(function (response) {
				var data = format_es_hits(response);
				callback(data);
			});
		},
		/* Etablissements */
		get_all_etablissements: function (filter, callback) {
			var body_query = {
					"query": {
						"filtered": {
							"query": {},
							"filter": {
								"and" : {
									"filters": []
								}
							}
						}
					}
				};

			if (filter) {
				body_query.query.filtered.query = {
					"query_string": {
						"query": "*" + filter.replace(" ", "\\ ") + "*",
						"fields": ["no_etab", "libelle"]
					}
				};
			} else {
				body_query.query.filtered.query = {"match_all": {}};
			}

			es.search({
				index: geoProConfig.elasticsearch.index,
				size: size_limit,
				type: etablissements_type_doc,
				body: body_query
			}).then(function (response) {
				var data = format_es_hits(response);
				callback(data);
			});
		},
		get_one_etablissement: function (code, callback) {
			es.get({
				index: geoProConfig.elasticsearch.index,
				id: code,
				type: etablissements_type_doc
			}, function (error, response) {
				if (error) {
					console.log(error);
				}
				var data = (response) ? response._source : null;
				
				callback(data);
			});
		},
		get_bounded_etablissement_by_activite_code: function (code, map_bounds, typo, callback) {
			var body_query = {
				"filter": {
					"and": {
						"filters": [
							{
								"query": {
									"match_phrase": {
										"rubriques": code
									}
								}
							},
							{
								"geo_bounding_box": {
									"coordinates": {
										"top_left": {
											"lat": map_bounds.top_right.lat,
											"lon": map_bounds.top_right.lng
										},
										"bottom_right" : {
											"lat": map_bounds.bottom_left.lat,
											"lon": map_bounds.bottom_left.lng
										}
									}
								}
							}
						]
					}
				}
			};

			if (typo) {
				// body_query.query.filtered.filter.and.filters.push({
				body_query.filter.and.filters.push({
					"query": {
						"match_phrase": {
							"typo": typo
						}
					}
				});
			}

			es.search({
				index: geoProConfig.elasticsearch.index,
				size: 5000,
				type: etablissements_type_doc,
				body: body_query
			}).then(function (response) {
				var data = format_es_hits(response);
				callback(data);
			});
		},
		/* Others */
		get_activites_from_ids: function (array_ids, callback) {
			es.mget({
				index: geoProConfig.elasticsearch.index,
				type: activites_type_doc,
				body: {
					ids: array_ids
				}
			}, function(error, response){
				var data = format_es_mget(response);
				callback(data);
			});
		},
		get_infos_commune: function (code, callback) {
			es.get({
				index: geoProConfig.elasticsearch.index,
				id: code,
				type: communes_type_doc
			}).then(function (response) {
				var data = response._source
				callback(data);
			});
		},
		write_new_comment: function (info, callback) {
			var today = new Date(),
				dd = today.getDate(),
				mm = today.getMonth()+1, //January is 0!
				yyyy = today.getFullYear();

			es.create({
		        index: geoProConfig.elasticsearch.index,
		        type: commentaires_type_doc,
		        body: {	            
		            user: info.prenom + ' ' + info.nom,
		            user_fonction: info.fonction,
		            date: yyyy + "-" + mm + "-" + dd,
		            commentaire: info.commentaire
		        }
		    }, function (error, response) {
		        callback(response, error);
		    });
		}
	};
});