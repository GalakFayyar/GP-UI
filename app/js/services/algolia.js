/* global appGeoPro, $ */
appGeoPro.factory('algoliaFactory',
	function($q, geoProConfig) {
		var factory = {};
		factory.data = [];
		factory.data.error = "";
		factory.data.algolia = geoProConfig.algolia;
		factory.data.nbSuggestionsAffichees = geoProConfig.algolia.nbSuggestionsAffichees;
		// Client algolia pour le qui/quoi
		factory.initIndexQuiQuoi = function () {
			//Initialisation du client algolia pour l'index des où.
			var clientQuiQuoi = algoliasearch(factory.data.algolia.algoliaClientAppId, factory.data.algolia.algoliaClientKey);
			indexQuiQuoi = clientQuiQuoi.initIndex(factory.data.algolia.indexQuiQuois);
		};
		// Client algolia pour les rubriques
		factory.initIndexRubriques=function () {
			//Initialisation du client algolia pour l'index des rubriques.
			var clientRubriques = algoliasearch(factory.data.algolia.algoliaClientAppId, factory.data.algolia.algoliaClientKey);
			indexRubrique = clientRubriques.initIndex(factory.data.algolia.indexRubriques);
		};
		// Client algolia pour le où
		factory.initIndexOu = function () {
			//Initialisation du client algolia pour l'index des où.
			var clientOu = algoliasearch(factory.data.algolia.algoliaClientAppId, factory.data.algolia.algoliaClientKey);
			factory.data.indexOu = clientOu.initIndex(factory.data.algolia.indexOus);
		};
		//On fixe l'erreur
		factory.setError = function (error) {
			factory.data.error = error;
		};
		//On lance la recherche sur algolia et on récupère les quiQuoi de l'auto-complete
		factory.getQuiQuois = function (queryTerm){
			var deferred = $q.defer();
			//On crée le client algolia pour l'index où s'il n'existe pas
			if(typeof(indexQuiQuoi)=="undefined") {
				factory.initIndexQuiQuoi();
			}
			indexQuiQuoi.search(queryTerm, function searchDone (err, content) {
				// err is either `null` or an `Error` object, with a `message` property
				// content is either the result of the command or `undefined`
				if (err) {
					factory.setError(error);
					return;
				}
				var res = [];
				if(content) {
					//On met les libellés de quiQuoi dans un tableau
					for(i in content.hits) {
						//On limite le nombre de suggestions
						if(i < factory.data.nbSuggestionsAffichees) {
							res.push(content.hits[i].libelle);
						}
					}
				}
				deferred.resolve(res);
			});
			return deferred.promise;
		};
		//On lance la recherche sur algolia et on récupère les rubriques de l'auto-complete
		// factory.getRubriques = function (typed_element, typeRendu){
		factory.getRubriques = function (typed_element, callback){
			// var deferred = $q.defer();
			// var res = [];
			//On crée le client algolia pour l'index où s'il n'existe pas
			if(typeof(indexRubrique) == "undefined") {
				factory.initIndexRubriques();
			}
			indexRubrique.search(typed_element, callback);
		};
		//On lance la recherche algolia sur le ou saisi ou auto-complété que l'on passe en paramètre de la fonction.
		factory.getOus = function (ou, callback){
			// var deferred = $q.defer()
			//On crée le client algolia pour l'index où s'il n'existe pas
			if(typeof(indexOu) == "undefined") {
				factory.initIndexOu();
			}
			factory.data.indexOu.search(ou, {
				"getRankingInfo": 1,
				"facets": "*",
				"attributesToRetrieve": "*",
				"highlightPreTag": "<em>",
				"highlightPostTag": "</em>",
				"hitsPerPage": 10,
				"facetFilters": [["_geoType:Localite","_geoType:Arrondissement"]],
				"maxValuesPerFacet": 10
			}, callback);
		}
		return factory;
	}
);