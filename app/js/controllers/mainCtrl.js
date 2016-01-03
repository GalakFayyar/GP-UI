'use strict'

appGeoPro.controller('MainCtrl', function ($scope, $filter, $timeout, $compile, $modal, ngProgress, uiGridConstants, uiGridGroupingConstants, uiGridExporterConstants, elasticService, algoliaFactory, geoProConfig) {
    // Définition des variables AngularJS pour l'outil
    $scope.lang="fr";
    $scope.version=geoProConfig.version;
    $scope.loading = {value: false};
    $scope.filtres = {
        display_all_etab : false,
        display_etab_prospects: false,
        display_etab_clients: false,
        display_filter: undefined,
        display_parution: ''
    };
    $scope.display = {
        legend: false,
        polpo: false,
        cvip: false,
        cvi: false,
        acces: false,
        lvs: false,
        bon_plan: false,
        lien_transac: false
    };
    $scope.typeZone = {selected: undefined};
    $scope.etablissement = {selected: undefined};
    $scope.activite = {selected: undefined};
    $scope.activite_connexe = {selected: null};
    $scope.commune = {selected: null};
    $scope.zoneChalandise = {
        selected: undefined,
        min: 10,
        max: 100,
        step: 5,
        value: 50
    };
    $scope.circle_chalandise = undefined;
    $scope.list_activites_connexes = [];
    $scope.list_communes = [];
    $scope.markers = [];
    $scope.markers_selected = {};
    $scope.communes = {
        parutions_layer: new L.featureGroup(),
        communes_layer: new L.featureGroup()
    };
    $scope.communes_with_activite = {};
    $scope.switchStatusClient = {value: false};
    $scope.alerts = [];


    ngProgress.height('4px');

    // Calcul des zones selon le geoJSON
    var caculateGeoJSON = function (code_activite) {
        elasticService.get_bounded_localites_with_activite(code_activite, $scope.map_bounds, function (communes_with_activites_localites) {
            // Suppression du layer
            $scope.communes_with_activite = communes_with_activites_localites.data;
            load_all_bounded_shapes_communes();
        });
    };

    var basemap = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    // Paramétrage et définition de la map Leaflet
    var map = new L.Map('map', {
        layers: [basemap],
        center: [48.853, 2.35],
        zoom: 10,
        minZoom: 10,
        maxZoom: 15,
        zoomControl: false
    });
    L.control.zoom({position: 'topright'}).addTo(map);

    // Définition des limites cartographiques de l'écran (initialisation)
    $scope.map_bounds = {
        'top_right': map.getBounds().getNorthWest(),
        'bottom_left': map.getBounds().getSouthEast()
    };

    // Chargement des markers (et contenu des popup) dans le scope
    var load_markers = function (list_etablissements, openPopup, selected) {
        list_etablissements.forEach(function (etablissement) {
            var customMarker = L.AwesomeMarkers.icon({
                icon: 'user',
                markerColor: (selected) ? 'red' : (etablissement.typo == "Client") ? 'blue' : 'gray',
                prefix: 'glyphicon',
                iconColor: 'white'
            });
            var marker = L.marker([etablissement.coordinates.lat, etablissement.coordinates.lon], {
                icon: customMarker,
                zIndexOffset: (selected) ? 500 : 0
                //zIndexOffset: ($scope.etablissement.selected && $scope.etablissement.selected.no_etab == etablissement.no_etab) ? 500 : 0
            }).addTo(map);

            if (selected) {
                $scope.markers_selected = marker;
            } else {
                $scope.markers.push(marker);
                map.addLayer(marker);
            }

            var content = '<div style="width:230px">' +
                            '<table class="table table-striped table-bordered table-condensed">' +
                            '<tr><th>Nom</th><td><b>' + etablissement.libelle + '</b></td></tr>' +
                            '<tr><th>Num. Etab</th><td>' + etablissement.no_etab + '</td></tr>' +
                            '<tr ng-show="!switchStatusClient.value"><th>Typologie</th><td>' + etablissement.typo + '</td></tr>';
            if (etablissement.typo == "Client") {
                content +=  '<tr ng-show="!switchStatusClient.value"><th>Rubrique principale</th><td>' + etablissement.rubrique_principale.libelle + '</td></tr>' + 
                            '<tr ng-show="!switchStatusClient.value"><th>Montant TS</th><td>' + etablissement.montants.ts + '</td></tr>' +
                            '<tr ng-show="!switchStatusClient.value"><th>Montant SEARCH</th><td>' + etablissement.montants.search + '</td></tr>' +
                            '<tr ng-show="!switchStatusClient.value"><th>Montant SITE</th><td>' + etablissement.montants.site + '</td></tr>' +
                            '<tr ng-show="!switchStatusClient.value"><th>Montant DISPLAY</th><td>' + etablissement.montants.display + '</td></tr>' +
                            '<tr ng-show="!switchStatusClient.value"><th>Montant PRINT</th><td>' + etablissement.montants.print + '</td></tr>';
            } else {
                content +=  '<tr ng-show="!switchStatusClient.value"><th>Rubrique officielle</th><td>' + etablissement.rubrique_principale.libelle + '</td></tr>' + 
                            '<tr ng-show="!switchStatusClient.value"><th>Appétence prospect</th><td>' + etablissement.appetence_prospect + '</td></tr>';
            }
            
            content +=      '</table>' +
                            '<button style="float:right;margin-top:5px" ng-click="setEtablissementAsSelected(\'' + etablissement.no_etab + '\')">Sélectionner</button>' +
                            '<div style="clear:both"></div>' +
                        '</div>';

            var linkFunction = $compile(angular.element(content)),
                newScope = $scope.$new();

            marker.bindPopup(linkFunction(newScope)[0], {
                maxWidth: "auto",
                closeButton: true
            });

            if (openPopup) {
                marker.openPopup();
            }
        });
    };
    
    // Ajout des localité dans le panier (via popup localité)
    $scope.addLocalitePanier = function (localite) {
        $scope.sidebarPanier.show();
        var list_localite = ($scope.list_communes && $scope.list_communes.length > 0) ? $scope.list_communes : undefined;
        if (list_localite) {
            var lookup_code = ($scope.activite_connexe.selected) ? $scope.activite_connexe.selected.code_activite : $scope.activite.selected.code_rubrique;
            elasticService.get_activite_by_code_and_localite(lookup_code, localite, function (commune_with_activite_localite) {
                var activite_localite = commune_with_activite_localite.data[0],
                    obj_localite = {
                        //'id': activite_localite.code + '' + activite_localite.commune.code,
                        'id': activite_localite._id,
                        'localite_libelle': (activite_localite) ? activite_localite.commune.libelle : $filter('filter')($scope.communes_with_activite, function (d) {return d.commune.code_commune == localite;})[0].libelle,
                        'localite_code': (activite_localite) ? activite_localite.commune.code_commune : localite,
                        'activite_code': activite_localite.code,
                        'activite_libelle': ($scope.activite_connexe.selected) ? $scope.activite_connexe.selected.libelle : $scope.activite.selected.activite,
                        'nb_recherches': (activite_localite) ? activite_localite.nb_recherches.pures.somme : 0
                    };
                if (!containsObject(obj_localite, $scope.gridOptions.data)){
                    $scope.gridOptions.data.push(obj_localite);
                }
            })
        } else {
            console.log("Liste des localités vide.");
        }
    };

    // Suppression des localités sélectionnées dans le tableau du panier
    $scope.removeLocalitePanier = function (localite) {
        angular.forEach($scope.gridApi.selection.getSelectedRows(), function (data, index) {
            $scope.gridOptions.data.splice($scope.gridOptions.data.lastIndexOf(data), 1);
        });
    };

    // Suppression des marqueurs passés en paramètre
    var unload_markers = function (list_markers) {
        list_markers.forEach(function (marker) {
            if (marker && marker != $scope.markers_selected) {
                map.removeLayer(marker);
            }
        });
    };

    // Function de synchronisation (instanciation sidebar après ngInclude)
    $scope.finishLoadingFiltres = function () {
        $scope.sidebarFiltres = L.control.sidebar("sidebarFiltres", {
            closeButton: true,
            position: "left"
        }).addTo(map);

        $scope.switchStatusParution = {
            value: false
        };
    };

    // Function de synchronisation (instanciation sidebar après ngInclude)
    $scope.finishLoadingPanier = function () {
        $scope.sidebarPanier = L.control.sidebar("sidebarPanier", {
            closeButton: true,
            position: "right"
        }).addTo(map);

        $scope.gridOptions = {
            enableFiltering: true,
            enableRowSelection: true,
            treeRowHeaderAlwaysVisible: false,
            exporterCsvColumnSeparator: ';',
            enableGridMenu: false,
            enableHorizontalScrollbar: uiGridConstants.scrollbars.WHEN_NEEDED,
            enableVerticalScrollbar: uiGridConstants.scrollbars.WHEN_NEEDED,
            showColumnFooter: true,
            showGridFooter: true,
            paginationPageSizes: [25, 50, 100],
            paginationPageSize: 25,
            //exporterFieldCallback: getExporterCallback(),
            //enableRowHeaderSelection: false,
            //enableFullRowSelection: true,
            columnDefs: [
                //{ name: 'activite', width: '30%' },
                { name: 'activite_libelle', displayName: 'Activités', grouping: { groupPriority: 0 }, sort: { priority: 0, direction: 'asc' }, width: '30%', aggregationType: uiGridConstants.aggregationTypes.count },
                //{ name: 'age', treeAggregationType: uiGridGroupingConstants.aggregation.MAX, width: '20%' },
                { name: 'localite_libelle', displayName: 'Localités', width: '30%', treeAggregationType: uiGridGroupingConstants.aggregation.COUNT },
                { name: 'nb_recherches', displayName: 'Nb. rech.', width: '30%', treeAggregationType: uiGridGroupingConstants.aggregation.SUM, enableFiltering: false, type: 'number' },
                // { name: 'registered', width: '40%', cellFilter: 'date', type: 'date' },
                // { name: 'state', grouping: { groupPriority: 0 }, sort: { priority: 0, direction: 'desc' }, width: '35%', cellTemplate: '<div><div ng-if="!col.grouping || col.grouping.groupPriority === undefined || col.grouping.groupPriority === null || ( row.groupHeader && col.grouping.groupPriority === row.treeLevel )" class="ui-grid-cell-contents" title="TOOLTIP">{{COL_FIELD CUSTOM_FILTERS}}</div></div>' },
                // { name: 'balance', width: '25%', cellFilter: 'currency', treeAggregationType: uiGridGroupingConstants.aggregation.AVG, customTreeAggregationFinalizerFn: function( aggregation ) { aggregation.rendered = aggregation.value;} }
            ],
            onRegisterApi: function( gridApi ) {
                $scope.gridApi = gridApi;
            }
        };

        $scope.expandAll = function(){
            $scope.gridApi.treeBase.expandAllRows();
        };

        $scope.toggleRow = function( rowNum ){
            $scope.gridApi.treeBase.toggleRowTreeState($scope.gridApi.grid.renderContainers.body.visibleRowCache[rowNum]);
        };

        $scope.changeGrouping = function() {
            $scope.gridApi.grouping.clearGrouping();
            $scope.gridApi.grouping.groupColumn('activite');
            //$scope.gridApi.grouping.aggregateColumn('activite', uiGridGroupingConstants.aggregation.COUNT);
        };

        $scope.getAggregates = function() {
            var aggregatesTree = [];

            var recursiveExtract = function( treeChildren ) {
                return treeChildren.map( function( node ) {
                    var newNode = {};
                    angular.forEach(node.row.entity, function( attributeCol ) {
                        if( typeof(attributeCol.groupVal) !== 'undefined' ) {
                            newNode.groupVal = attributeCol.groupVal;
                            newNode.aggVal = attributeCol.value;
                        }
                    });
                    newNode.otherAggregations = node.aggregations.map( function( aggregation ) {
                        return { 
                            colName: aggregation.col.name, 
                            value: aggregation.value, 
                            type: aggregation.type 
                        };
                    });
                    if( node.children ) {
                        newNode.children = recursiveExtract( node.children );
                    }
                    return newNode;
                });
            }

            aggregatesTree = recursiveExtract( $scope.gridApi.grid.treeBase.tree );

            console.log(aggregatesTree);
        };
        //$scope.gridOptions.data = $scope.list_panier_localites;
    };

    // Gestion affichage des Filtres
    $scope.toggleSidebarFiltres = function () {
        $scope.sidebarFiltres.toggle();
        return false;
    };
    
    // Gestion affichage du Panier
    $scope.toggleSidebarPanier = function () {
        $scope.sidebarPanier.toggle();
        return false;
    };

    // Changement d'établissement
    $scope.selectEtablissement = function (reset_filtres_etablissements) {
        ngProgress.start();
        $scope.loading.value = true;

        // Suppression des filtres de parution précédents
        resetParutionFiltres();

        // center
        map.panTo(new L.LatLng($scope.etablissement.selected.coordinates.lat, $scope.etablissement.selected.coordinates.lon));
        //map.setZoom(13);
        refresh_map_boundaries();

        clear_selected_field('activite_connexe');

        // Ajout du layer de l'activité principal pour l'établissement
        $scope.activite.selected = {
            activite: $scope.etablissement.selected.rubrique_principale.libelle,
            code_rubrique: $scope.etablissement.selected.rubrique_principale.code_rubrique
        };

        // Redéclenchement de la sélection d'activité
        $scope.selectActivite();

        // Vidage champs Commune
        clear_selected_field('commune');
        if ($scope.selected_commune_marker) {
            unload_markers([$scope.selected_commune_marker])
        }
 
        // Suppression du précent marker selectionné
        map.removeLayer($scope.markers_selected);

        // On garde le fitlres d'affichage des établissements lors du switch d'établissement
        // sélectionné
        if (reset_filtres_etablissements) {
            resetFiltresEtablissements();
        }

        load_markers([$scope.etablissement.selected], true, true);
        $scope.typeZone.selected = 'etablissement';

        $scope.switchStatusParution.value = false;

        // Gestion grisage des options Parutions (communes) dispo pour le pro
        manageEnableFilterParution()
    };

    // Mise à jour des markers établissements selon la typo (si nulle : tous les etablissements)
    var refresh_markers_etablissements = function (typo) {
        elasticService.get_bounded_etablissement_by_activite_code($scope.activite.selected.code_rubrique, $scope.map_bounds, typo, function (_activites_etablissements_with_boundary) {
            unload_markers($scope.markers);
            load_markers(_activites_etablissements_with_boundary.data, false);
            ngProgress.complete();
            $scope.loading.value = false;
        });
    };

    // Gestion de l'affichage des filtres de parutions (boutons grisés)
    var manageEnableFilterParution = function () {
        if ($scope.etablissement.selected) {
            var code_activite = ($scope.activite_connexe.selected) ? $scope.activite_connexe.selected.code_rubrique : $scope.activite.selected.code_rubrique;
            // Gestion grisage des options Parutions (communes) dispo pour le pro
            $scope.etablissement.selected.parution_com.forEach(function (parution) {
                $scope.display.polpo = $scope.display.polpo || (parution.polpo && parution.code_activite == code_activite);
                $scope.display.cvip = $scope.display.cvip || (parution.cvip && parution.code_activite == code_activite);
                $scope.display.cvi = $scope.display.cvi || (parution.cvi && parution.code_activite == code_activite);
                $scope.display.acces = $scope.display.acces || (parution.acces && parution.code_activite == code_activite);
                $scope.display.lvs = $scope.display.lvs || (parution.lvs && parution.code_activite == code_activite);
                $scope.display.bon_plan = $scope.display.bon_plan || (parution.bon_plan && parution.code_activite == code_activite);
                $scope.display.lien_transac = $scope.display.lien_transac || (parution.lien_transac && parution.code_activite == code_activite);
            });

            // Gestion grisage des options Parutions (départements) dispo pour le pro
            $scope.etablissement.selected.parution_dep.forEach(function (parution) {
                $scope.display.polpo = $scope.display.polpo || (parution.polpo && parution.code_activite == code_activite);
                $scope.display.cvip = $scope.display.cvip || (parution.cvip && parution.code_activite == code_activite);
                $scope.display.cvi = $scope.display.cvi || (parution.cvi && parution.code_activite == code_activite);
                $scope.display.acces = $scope.display.acces || (parution.acces && parution.code_activite == code_activite);
                $scope.display.lvs = $scope.display.lvs || (parution.lvs && parution.code_activite == code_activite);
                $scope.display.bon_plan = $scope.display.bon_plan || (parution.bon_plan && parution.code_activite == code_activite);
                $scope.display.lien_transac = $scope.display.lien_transac || (parution.lien_transac && parution.code_activite == code_activite);
            });
        }
    };

    // Changement d'activité
    $scope.selectActivite = function () {
        // Lorsque sélection activité : chargement du layer avec toutes les communes
        // et les infos pour cette activité (coloration et indicateur par localité)
        ngProgress.start();
        $scope.loading.value = true;
        $scope.list_activites_connexes = [];

        //clear_layer_communes();

        caculateGeoJSON($scope.activite.selected.code_rubrique);

        manageEnableFilterParution();

        // Affichage des établissements pour cette activité
        if ($scope.etablissement.selected && $scope.filtres.display_etablissements_activite) {
            unload_markers($scope.markers);
            // Récupère l'activité de cet établissement
            var list_etablissements_a_afficher = $filter('filter')($scope.list_etablissements, function (d) {return d.rubrique == $scope.activite.selected.code_rubrique; });
            load_markers(list_etablissements_a_afficher, false);
        };

        // Alimentation de la liste des activités connexes
        elasticService.get_activite_connexe_by_activite_code($scope.activite.selected.code_rubrique, function (_activites_connexes) {
            _activites_connexes.data.forEach(function (_activite_connexe) {
                $scope.list_activites_connexes.push(_activite_connexe.rubrique_connexe);
            });
        });
    };

    // Sélection d'une activité connexe
    $scope.selectActiviteConnexe = function () {
        ngProgress.start();
        $scope.loading.value = true;
        caculateGeoJSON($scope.activite_connexe.selected.code_rubrique, null, function () {
            load_all_bounded_shapes_communes();
        });
    };

    // Changement de commune
    $scope.selectCommune = function () {
        ngProgress.start();

        // Récupération des centroides
        var infos_commune = elasticService.get_infos_commune($scope.commune.selected.code_commune, function (commune) {
            $scope.commune.selected.centroid_y = commune.properties.centroide_y;
            $scope.commune.selected.centroid_x = commune.properties.centroide_x;

            map.panTo(new L.LatLng($scope.commune.selected.centroid_y, $scope.commune.selected.centroid_x));

            // Ajout du marker
            var customMarker = L.AwesomeMarkers.icon({
                    icon: 'pushpin',
                    markerColor: 'dark-red',
                    prefix: 'glyphicon',
                    iconColor: 'white'
                });
            $scope.selected_commune_marker = L.marker([$scope.commune.selected.centroid_y, $scope.commune.selected.centroid_x], {
                icon: customMarker,
                zIndexOffset: 501
            }).addTo(map);

            $scope.typeZone.selected = 'localite';

            // if ($scope.commune.selected.layer) {
            //     $scope.commune.selected.layer.openPopup({lat: $scope.commune.selected.centroid_y, lon: $scope.commune.selected.centroid_x});
            // }

            refreshMap();

            map.setZoom(11);
        });
    };

    // Vidage des listes de valeurs
    $scope.clear_etablissement = function ($event, element) {
        map.removeLayer($scope.markers_selected);

        element.selected = undefined;

        if ($scope.activite.selected) {
            var activite_etab_selec = $scope.activite.selected.code_rubrique;
            var list_etablissements_a_afficher = $filter('filter')($scope.list_etablissements, function (d) {return d.rubrique == activite_etab_selec; });
            load_markers(list_etablissements_a_afficher, false);
        }

        $event.stopPropagation(); 

        $scope.clearZoneChalandise();
        $scope.typeZone.selected = undefined;

        // Suppression parution
        resetParutionFiltres();
    };

    // Vidage des listes de valeurs
    $scope.clear_activite = function ($event, element) {
        unload_markers($scope.markers);
        unload_markers([$scope.selected_commune_marker]);

        clear_layer_activites_communes();
        clear_layer_communes();

        $event.stopPropagation(); 
        element.selected = undefined;

        $scope.clearZoneChalandise();
        clear_selected_field('activite_connexe');
        clear_selected_field('commune');

        // Nettoyage liste des activités connexes
        $scope.list_activites_connexes = [];

        // Nettoyage des filtres
        resetFiltresEtablissements();

        // Suppression parution
        resetParutionFiltres();
    };

    // Nettoyage champs Activités Connexes
    $scope.clear_activite_connexe = function ($event, element){
        ngProgress.start();
        $scope.loading.value = true;
        caculateGeoJSON($scope.activite.selected.code_rubrique);

        $event.stopPropagation(); 
        clear_selected_field('activite_connexe');

        // Suppression parution
        resetParutionFiltres();
    };

    // Nettoyage champs Communes
    $scope.clear_commune = function ($event, element) {
        $event.stopPropagation(); 
        clear_selected_field('commune');
        if ($scope.selected_commune_marker) {
            unload_markers([$scope.selected_commune_marker])
        }
        map.setZoom(10);
    };

    // Fonction générique de nettoyage de champ
    var clear_selected_field = function (field) {
        if ($scope[field] && $scope[field].selected) {
            $scope[field].selected = undefined;
        }
    };

    // Méthode de tracer pour la zone de chalandise
    $scope.drawZoneChalandise = function () {
        $scope.clearZoneChalandise();

        var latlng = undefined,
            circle_style = undefined;

        switch ($scope.typeZone.selected) {
            case "etablissement":
                latlng = {
                    lat: $scope.etablissement.selected.coordinates.lat,
                    lon: $scope.etablissement.selected.coordinates.lon
                };
                circle_style = {
                    color: '#016C1E',
                    fillColor: 'transparent',
                    fillOpacity: 1,
                    weight: 7
                };
                break;
            case "localite":
                latlng = {
                    lat: $scope.commune.selected.centroid_y,
                    lon: $scope.commune.selected.centroid_x
                };
                circle_style = {
                    color: '#016C1E',
                    fillColor: 'transparent',
                    fillOpacity: 1,
                    weight: 7
                };
                break;
            default:
                latlng = {lat: 48.8534,lon:  2.3488}; // Paris
                circle_style = {};
        }

        $scope.circle_chalandise = L.circle(latlng, ($scope.zoneChalandise.selected*1000), circle_style);
        $scope.circle_chalandise.addTo(map);
        $scope.circle_chalandise.bringToFront();
        map.fitBounds($scope.circle_chalandise.getBounds());
    };

    // Suppression de la zone de chalandise
    $scope.clearZoneChalandise = function () {
        if ($scope.circle_chalandise) {
            map.removeLayer($scope.circle_chalandise);
            $scope.circle_chalandise = undefined;
        };
    };

    // Mise à jour de la liste des établissements suggérés
    $scope.refreshEtablissement = function (typed_value) {
        elasticService.get_all_etablissements(typed_value, function (_etablissements, getResponseHeaders) {
            $scope.list_etablissements = _etablissements.data;
        });
    };

    // Mise à jour de la liste des activités suggérées
    $scope.refreshActivite = function (typed_value) {
        // elasticService.get_all_ref_activites(typed_value, function (_activites) {
        //     $scope.list_activites = _activites.data;
        // });
        algoliaFactory.getRubriques(typed_value, function searchDone (err, content) {
            var res = [];
            if (err) {
                console.log(error);
                return [];
            }
            if(content) {
                content.hits.forEach(function (hit) {
                    res.push({
                        'activite': hit.libelle,
                        'code_rubrique': hit.objectID
                    });
                });
            }
            $scope.list_activites = res
            $scope.$broadcast('SelectFocusActivite');
        });
    };

    // Mise à jour de la liste des communes suggérées
    $scope.refreshCommune = function (typed_value) {
        elasticService.get_all_ref_communes(typed_value, function (_communes) {
            $scope.list_communes = _communes.data;
        });
        // algoliaFactory.getOus(typed_value, function searchDone (err, content) {
        //     var res = [];
        //     if (err) {
        //         console.log(error);
        //         return [];
        //     }
        //     if(content) {
        //         content.hits.forEach(function (hit) {
        //             res.push({
        //                 'libelle': hit.libelle,
        //                 'code_commune': hit.objectID.substring(2,7)
        //             });
        //         });
        //     }
        //     $scope.list_communes = res
        //     $scope.$broadcast('SelectFocusCommune');
        // });
    };

    // Méthode de suppression du calque des communes contenant des activités
    var clear_layer_activites_communes = function () {
        if ($scope.communes_with_activite && $scope.communes_with_activite.layers) {
            $scope.communes_with_activite.layers.clearLayers();
        }
    };

    // Méthode de suppression du calque des communes
    var clear_layer_communes = function () {
        if ($scope.communes && $scope.communes.communes_layer) {
            $scope.communes.communes_layer.clearLayers();
        }
    };

    // Méthode de mise à jour des limites de la carte en fonction de l'écran
    var refresh_map_boundaries = function () {
        var map_bounds = map.getBounds();
        $scope.map_bounds.top_right = map_bounds.getNorthWest();
        $scope.map_bounds.bottom_left = map_bounds.getSouthEast();
    };

    // Méthode mise à jour des informations de la carte
    var refreshMap = function () {
        if ($scope.activite_connexe.selected || $scope.activite.selected || ($scope.etablissement.selected && $scope.activite.selected)) {
            ngProgress.start();
            $scope.loading.value = true;
        }

        refresh_map_boundaries();

        // Gestion de l'affichage de la parution
        if ($scope.switchStatusParution.value) {
            $scope.manageFiltersParution();
        } else {
            if ($scope.activite_connexe.selected){
            caculateGeoJSON($scope.activite_connexe.selected.code_rubrique);
            } else if ($scope.activite.selected) {
                caculateGeoJSON($scope.activite.selected.code_rubrique);
            }
        }

        var typo;
        if ($scope.filtres.display_all_etab) {
            // Recalcul des markers pour établissements
            typo = "all";
        }

        if ($scope.filtres.display_etab_prospects) {
            // Recalcul des markers pour prospects
            typo = "prospects";
        }

        if ($scope.filtres.display_etab_clients) {
            // Recalcul des markers pour clients
            typo = "clients";
        }

        $scope.manageFilters(typo);
    };

    // Gestion des filtres : affichage des établissements
    $scope.manageFilters = function (typo) {
        if (!$scope.filtres.display_all_etab && !$scope.filtres.display_etab_prospects && !$scope.filtres.display_etab_clients){
            unload_markers($scope.markers);
        }

        switch (typo) {
            case "all":
                if ($scope.filtres.display_all_etab) {
                    ngProgress.start();
                    $scope.loading.value = true;
                    refresh_markers_etablissements();
                    $scope.filtres.display_etab_clients = false;
                    $scope.filtres.display_etab_prospects = false;
                }
                break;
            case "prospects":
                if ($scope.filtres.display_etab_prospects) {
                    ngProgress.start();
                    $scope.loading.value = true;
                    refresh_markers_etablissements("Prospect");
                    $scope.filtres.display_all_etab = false;
                    $scope.filtres.display_etab_clients = false;
                }
                break;
            case "clients":
                if ($scope.filtres.display_etab_clients) {
                    ngProgress.start();
                    $scope.loading.value = true;
                    refresh_markers_etablissements("Client");
                    $scope.filtres.display_all_etab = false;
                    $scope.filtres.display_etab_prospects = false;
                }
                break;
        }
    };

    // Méthode de reset des filtres sur établissements
    var resetFiltresEtablissements = function () {
        $scope.filtres.display_all_etab = false;
        $scope.filtres.display_etab_prospects = false;
        $scope.filtres.display_etab_clients = false;
    };

    // Méthode de tri spécifique pour les activités
    var predicatBy = function (prop1, prop2, prop3) {
        return function(a,b){
            if( a[prop1][prop2][prop3] < b[prop1][prop2][prop3]) {
                return 1;
            } else if( a[prop1][prop2][prop3] > b[prop1][prop2][prop3] ) {
                return -1;
            }
            return 0;
        }
    };

    var columnsHeaderExport = [
        "Code Activite",
        "Libelle Activite",
        "Code Commune",
        "Commune",
        "Potentiel Audience",
        "Recherches Totales",
        "Recherches Pures",
        "Recherches Alpha + Croisees",
        "Contacts Totaux",
        "Contacts Alpha + Croises",
        "Contacts Purs",
        "Clics Totaux",
        "Clics Alpha + Croises",
        "Clics Purs"
    ];

    // Export CSV du contenu du panier enrichi avec les informations activités
    $scope.exportPanierLocalitesCSV = function () {
        //$scope.gridApi.exporter.csvExport(uiGridExporterConstants.ALL, uiGridExporterConstants.ALL);

        var tab_ids = [];
        $scope.gridOptions.data.forEach(function (row) {
            tab_ids.push(row.id);
        });

        elasticService.get_activites_from_ids(tab_ids, function (activites) {
            var csvContent = "data:text/csv;charset=ISO-8859-1,";

            // var enteteColumns =  "Code Activité;Libellé Activité;Code Commune;Commune;Potentiel Audience;Recherches Totales;Recherches Pures; Recherches Alpha + Croisées;";
            //     enteteColumns += "Contacts Totaux;Contacts Alpha + Croisés;Contacts Purs;Clics Totaux;Clics Alpha + Croisés; Clics Purs;\n";
            var enteteColumns = columnsHeaderExport.join(';') + "\n";

            csvContent += enteteColumns;

            activites.data.sort( predicatBy("nb_recherches", "pures", "somme") );

            activites.data.forEach(function (activite, index){
                var libelle_activite = $filter('filter')($scope.gridOptions.data, function (d) {return (d.localite_code == activite.commune.code_commune && d.activite_code == activite.code);})[0].activite_libelle;
                csvContent +=   activite.code_activite + ";" +
                                libelle_activite + ";" +
                                activite.commune.code_commune + ";" +
                                activite.commune.libelle + ";" +
                                activite.pot_audience + ";" +
                                activite.nb_recherches.total.somme + ";" +
                                activite.nb_recherches.pures.somme + ";" +
                                activite.nb_recherches.alpha.somme + ";" +
                                activite.nb_contacts.total + ";" +
                                activite.nb_contacts.alpha + ";" +
                                activite.nb_contacts.pures + ";" +
                                activite.nb_clics.total + ";" +
                                activite.nb_clics.alpha + ";" +
                                activite.nb_clics.pures + ";\n";
            });
            var encodedUri = encodeURI(csvContent);

            var link = document.createElement('a');;
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "export-geopro.csv");
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    };

    // Export PDF du contenu du panier enrichi avec les informations activités
    // $scope.exportPanierLocalitesPDF = function () {
    //     ngProgress.start();
    //     // Contruction de l'entete avec son style
    //     var header = [];
    //     columnsHeaderExport.forEach(function (column_name) {
    //         header.push({text: column_name, style: 'headerLineStyle'});
    //     });

    //     var docDefinition = {
    //         header: 'Export Activité Localités - GeoPro',
    //         footer: {
    //             columns: [
    //                 'GeoPro',
    //                 { text: 'Pages Jaunes', alignment: 'right' }
    //             ]
    //         },
    //         // by default we use portrait, you can change it to landscape if you wish
    //         pageOrientation: 'landscape',
    //         // [left, top, right, bottom] or [horizontal, vertical] or just a number for equal margins
    //         pageMargins: [ 40, 60, 40, 60 ],
    //         styles: {
    //             headerLineStyle: {
    //                 fontSize: 7,
    //                 bold: true
    //             },
    //             lineStyle: {
    //                 fontSize: 7,
    //                 bold: false
    //             }
    //         },
    //         content: [
    //             {
    //                 table: {
    //                     // headers are automatically repeated if the table spans over multiple pages
    //                     // you can declare how many rows should be treated as headers
    //                     headerRows: 1,
    //                     widths: [ 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto' ],
    //                     body: [
    //                         header
    //                         //[ 'Value 1', 'Value 2', 'Value 3', 'Value 4' ],
    //                         //[ { text: 'Bold value', bold: true }, 'Val 2', 'Val 3', 'Val 4' ]
    //                     ]
    //                 }
    //             }
    //             // ,{
    //             //     // if you specify both width and height - image will be stretched
    //             //     image: 'data:image/jpeg;base64,...encodedContent...',
    //             //     width: 150,
    //             //     height: 150
    //             // }
    //         ]
    //     };

        

    //     var tab_ids = [];
    //     $scope.gridOptions.data.forEach(function (row) {
    //         tab_ids.push(row.id);
    //     });

    //     elasticService.get_activites_from_ids(tab_ids, function (activites) {
    //         activites.data.sort( predicatBy("nb_recherches", "pures", "somme") );
    //         activites.data.forEach(function (activite, index){
    //             var libelle_activite = $filter('filter')($scope.gridOptions.data, function (d) {return (d.localite_code == activite.commune.code_commune && d.activite_code == activite.code);})[0].activite_libelle;
    //             var new_line = [{text:activite.code_activite, style: 'lineStyle'},
    //                             {text:libelle_activite, style: 'lineStyle'},
    //                             {text:activite.commune.code_commune, style: 'lineStyle'},
    //                             {text:activite.commune.libelle, style: 'lineStyle'},
    //                             {text:activite.pot_audience, style: 'lineStyle'},
    //                             {text:activite.nb_recherches.total.somme.toString(), style: 'lineStyle'},
    //                             {text:activite.nb_recherches.pures.somme.toString(), style: 'lineStyle'},
    //                             {text:activite.nb_recherches.alpha.somme.toString(), style: 'lineStyle'},
    //                             {text:activite.nb_contacts.total.toString(), style: 'lineStyle'},
    //                             {text:activite.nb_contacts.alpha.toString(), style: 'lineStyle'},
    //                             {text:activite.nb_contacts.pures.toString(), style: 'lineStyle'},
    //                             {text:activite.nb_clics.total.toString(), style: 'lineStyle'},
    //                             {text:activite.nb_clics.alpha.toString(), style: 'lineStyle'},
    //                             {text:activite.nb_clics.pures.toString(), style: 'lineStyle'}];

    //             docDefinition.content[0].table.body.push(new_line);
    //         });
    //         pdfMake.createPdf(docDefinition).download('export-geopro.pdf');
    //         //console.log(JSON.stringify(docDefinition));
    //         ngProgress.complete();
    //     });
    // };

    // Nettoyage du panier des localités
    $scope.viderPanierLocalites = function () {
        //$scope.list_panier_localites = [];
        $scope.gridOptions.data = [];
    };

    // Méthode de chargement des geo_shape pour les communes
    var load_all_bounded_shapes_communes = function () {
        elasticService.get_all_bounded_communes($scope.map_bounds, function (communes) {
            var activite_code = ($scope.activite_connexe.selected) ? $scope.activite_connexe.selected.code_rubrique : $scope.activite.selected.code_rubrique;

            elasticService.get_ref_activite_by_code(activite_code, function (activite_zu) {
                clear_layer_communes();

                communes.data.forEach(function (commune) {
                    var opt_polyline = {
                            color: '#333',
                            fillColor: '#DCDCDC',
                            fillOpacity: 0.1
                        };

                    var geo_commune = L.geoJson(commune, {
                        weight: 1,
                        style: opt_polyline,
                        onEachFeature: function (feature, layer) {
                            var infos_activite_localite = $filter('filter')($scope.communes_with_activite, function (d) {return d.commune.code_commune == feature.properties.code; })[0];
                            if (feature.properties.nom == "ZU") {
                                var content = '<div>' +
                                                '<h4><b>' + feature.properties.nom + '</b></h4>' +
                                                //'<small>' + feature.properties.code + '</small>' +
                                              '</div>',
                                    linkFunction = $compile(angular.element(content)),
                                    newScope = $scope.$new();

                                layer.bindPopup(linkFunction(newScope)[0], {
                                    minWidth: "230",
                                    maxWidth: "auto",
                                    closeButton: true
                                });

                                layer.setStyle({
                                    color: '#000',
                                    fillColor: 'transparent',
                                    fillOpacity: 0.8,
                                    weight: 6
                                });
                            } else {
                                var libelle_commune = (infos_activite_localite && infos_activite_localite.commune) ? infos_activite_localite.commune.libelle : feature.properties.nom,
                                    code_commune = (infos_activite_localite && infos_activite_localite.commune) ? infos_activite_localite.commune.code_commune : feature.properties.code,
                                    nb_recherches = (infos_activite_localite && infos_activite_localite.nb_recherches) ? infos_activite_localite.nb_recherches.pures.somme : "<i>0</i>",
                                    panier1 = (infos_activite_localite && infos_activite_localite.paniers.panier1 != -1) ? infos_activite_localite.paniers.panier1 : "<i>inconnu</i>",
                                    panier2 = (infos_activite_localite && infos_activite_localite.paniers.panier2 != -1) ? infos_activite_localite.paniers.panier2 : "<i>inconnu</i>",
                                    panier3 = (infos_activite_localite && infos_activite_localite.paniers.panier3 != -1) ? infos_activite_localite.paniers.panier3 : "<i>inconnu</i>",
                                    panier4 = (infos_activite_localite && infos_activite_localite.paniers.panier4 != -1) ? infos_activite_localite.paniers.panier4 : "<i>inconnu</i>",
                                    panier5 = (infos_activite_localite && infos_activite_localite.paniers.panier5 != -1) ? infos_activite_localite.paniers.panier5 : "<i>inconnu</i>",
                                    panier_total = (infos_activite_localite && infos_activite_localite.paniers.panier_total != -1) ? infos_activite_localite.paniers.panier_total : "<i>inconnu</i>";
                                    //panier_total = parseInt(panier1) + parseInt(panier2) + parseInt(panier3) + parseInt(panier4);

                                var content = '<div style="width:230px">' +
                                        '<h4><b>' + libelle_commune + '</b></h4>' +
                                        '<table class="table table-striped table-bordered table-condensed">' +
                                        '<tr><th>Code Commune</th><td>' + code_commune + '</td></tr>' +
                                        '<tr><th>Nb Recherches Pures <br/><small>(sur une 1 année glissante)</small></th><td>' + nb_recherches + '</td></tr>' +
                                        '<tr><th>Locaux rankés</th><td>' + panier1 + '</td></tr>' +
                                        '<tr><th>Locaux non-rankés</th><td>' + panier2 + '</td></tr>' +
                                        '<tr><th>Extra-locaux rankés</th><td>' + panier3 + '</td></tr>' +
                                        '<tr><th>Extra-locaux non-rankés</th><td>' + panier4 + '</td></tr>' +
                                        // '<tr><th>Autres</th><td>' + panier5 + '</td></tr>' +
                                        // '<tr><th>Taille de la LR</th><td>' + panier_total + '</td></tr>' +
                                        '</table>';
                                if (infos_activite_localite) {
                                    content += '<button style="float:right;margin-top:5px" ng-disabled="loading.value" ng-click="addLocalitePanier(\'' + code_commune + '\')">Ajouter au panier</button>';
                                }
                                content += '<div style="clear:both"></div>' +
                                        '</div>',
                                        linkFunction = $compile(angular.element(content)),
                                        newScope = $scope.$new();

                                layer.bindPopup(linkFunction(newScope)[0], {
                                    maxWidth: "auto",
                                    closeButton: true
                                });

                                var opt_polyline = {
                                    color: '#333',
                                    fillOpacity: 0.4,
                                    weight: 1
                                };

                                // Communes avec infos activité
                                if (infos_activite_localite && infos_activite_localite.pot_audience) {
                                    switch (infos_activite_localite.pot_audience) {
                                        case '4-Faible':
                                            opt_polyline.fillColor = '#ADFF2F';
                                            break;
                                        case '3-Moyen':
                                            opt_polyline.fillColor = '#90EE90';
                                            break;
                                        case '2-Fort':
                                            opt_polyline.fillColor = '#3CB371';
                                            break;
                                        case '1-Très Fort':
                                            opt_polyline.fillColor = '#006400';
                                            break;
                                        default:
                                            opt_polyline.fillColor = '#DCDCDC';
                                            break;
                                    }
                                } else {
                                    opt_polyline.fillColor = '#DCDCDC';
                                }
                                layer.setStyle(opt_polyline);
                            }

                            layer.on('mouseover', function (e) {
                                document.getElementById("commune-title").innerHTML = feature.properties.nom;
                                $("#commune-title").stop();
                                $("#commune-title").fadeIn(10);
                                $("#commune-title").fadeOut(5000);
                            });
                        },
                        filter: function(feature, layer) {
                            if (activite_zu && activite_zu.data && activite_zu.data.length > 0 && feature.properties.nom == "ZU") {
                                return activite_zu.data[0].zu;
                            } else {
                                return true;
                            }
                        }
                    });
                    $scope.communes.communes_layer.addLayer(geo_commune);
                });

                map.addLayer($scope.communes.communes_layer);
               
                ngProgress.complete();
                $scope.loading.value = false;
            });
        });
    };

    // Méthode de vérification si un object (obj) est contenu dans une liste (list)
    var containsObject = function (obj, list) {
        var i;
        for (i = 0; i < list.length; i++) {
            if (list[i].id === obj.id) {
                return true;
            }
        }
        return false;
    };

    // Ajout de toutes les localités affichées à l'écran dans le panier
    $scope.addScreenLocalitePanier = function () {
        ngProgress.start();
        refresh_map_boundaries();
        var code_activite = ($scope.activite_connexe.selected) ? $scope.activite_connexe.selected.code_rubrique : $scope.activite.selected.code_rubrique;
        elasticService.get_bounded_localites_with_activite(code_activite, $scope.map_bounds, function (activites) {
            activites.data.forEach(function (activite) {
                var obj_localite = {
                        //'id': activite.code + '' + activite.commune.code,
                        'id': activite._id,
                        'localite_code': activite.commune.code_commune,
                        'localite_libelle': activite.commune.libelle,
                        'activite_code': activite.code,
                        'activite_libelle': ($scope.activite_connexe.selected) ? $scope.activite_connexe.selected.libelle : $scope.activite.selected.activite,
                        'nb_recherches': activite.nb_recherches.pures.somme
                    };
                if (!containsObject(obj_localite, $scope.gridOptions.data)){
                    $scope.gridOptions.data.push(obj_localite);
                }
            });
            ngProgress.complete();
        });
    };

    // Ajout de toutes les localités dans la zone de chalandise dans le panier
    $scope.addZoneChalandisePanier = function () {
        ngProgress.start();
        var zone_map_bounds = {
            top_right: $scope.circle_chalandise.getBounds().getNorthWest(),
            bottom_left: $scope.circle_chalandise.getBounds().getSouthEast()
        };
        var code_activite = ($scope.activite_connexe.selected) ? $scope.activite_connexe.selected.code_rubrique : $scope.activite.selected.code_rubrique;
        elasticService.get_bounded_localites_with_activite(code_activite, zone_map_bounds, function (activites) {
            activites.data.forEach(function (activite) {
                var obj_localite = {
                        //'id': activite.code + '' + activite.commune.code,
                        'id': activite._id,
                        'localite_code': activite.commune.code_commune,
                        'localite_libelle': activite.commune.libelle,
                        'activite_code': activite.code,
                        'activite_libelle': ($scope.activite_connexe.selected) ? $scope.activite_connexe.selected.libelle : $scope.activite.selected.activite,
                        'nb_recherches': activite.nb_recherches.pures.somme
                    };
                if (!containsObject(obj_localite, $scope.gridOptions.data)){
                    $scope.gridOptions.data.push(obj_localite);
                }
                ngProgress.complete();
            });
        });
    };

    // Gestion du bouton (switch) pour les parutions
    $scope.manageParutionSwitch = function () {
        if (!$scope.switchStatusParution.value) {
            // Récupération des infos de l'établissement
            var code_activite = ($scope.activite_connexe.selected) ? $scope.activite_connexe.selected.code_rubrique : $scope.activite.selected.code_rubrique;

            // Suppression du layer
            $scope.communes.parutions_layer.clearLayers();
            map.removeLayer($scope.communes.parutions_layer);
            caculateGeoJSON(code_activite);

            // Suppression des boutons radios cochés
            $scope.filtres.display_parution = '';
        }
    };

    // Gestion des filtres pour les parutions
    $scope.manageFiltersParution = function () {
        ngProgress.start();
        if ($scope.communes.parutions_layer) {
            map.removeLayer($scope.communes.parutions_layer);
            $scope.communes.parutions_layer.clearLayers();

            var code_activite = ($scope.activite_connexe.selected) ? $scope.activite_connexe.selected.code_rubrique : $scope.activite.selected.code_rubrique;
            caculateGeoJSON(code_activite);
        }
        display_element_parution($scope.filtres.display_parution);
    };

    // Méthode d'affichage des éléments de parution en fonction d'un élement
    var display_element_parution = function (element) {
        // Récupération des infos de l'établissement
        var code_activite = ($scope.activite_connexe.selected) ? $scope.activite_connexe.selected.code_rubrique : $scope.activite.selected.code_rubrique;
        // Parcours des parutions communales
        var communes_locales_concernees = [];
        $scope.etablissement.selected.parution_com.forEach(function (parution) {
            if (parution[element] && parution.code_activite == code_activite) {
                var tmp_element = $filter('filter')($scope.communes_with_activite, function (d) {return d.commune.code_commune == parution.code_commune;});
                if (tmp_element.length > 0) {
                    communes_locales_concernees.push(tmp_element[0].commune);
                }
            }
        });
        $scope.communes.parutions_layer = L.geoJson(communes_locales_concernees, {
            weight: 8,
            style: {
                color: 'blue',
                fillColor: 'transparent',
                fillOpacity: 0
            }
        });
        $scope.communes.parutions_layer.addTo(map);

        $scope.departements_concernes_parution = [];
        $scope.etablissement.selected.parution_dep.forEach(function (parution) {
            if (parution[element] && parution.code_activite == code_activite) {
                $scope.departements_concernes_parution.push(parution.code_departement);
            }
        });
    };

    // Méthode de Reset des filtres de parution
    var resetParutionFiltres = function () {
        $scope.switchStatusParution.value = false;
        $scope.filtres.display_parution = '';

        $scope.display.legend = false;
        $scope.display.polpo = false;
        $scope.display.cvip = false;
        $scope.display.cvi = false;
        $scope.display.acces = false;
        $scope.display.lvs = false;
        $scope.display.bon_plan = false;
        $scope.display.lien_transac = false;

        if ($scope.communes.parutions_layer) {
            map.removeLayer($scope.communes.parutions_layer);
        }
    };

    // Gestion du switch Vue Client / Vue Commercial
    $scope.switchStatusClient = function () {
        var alert = {
            msg: ($scope.switchStatusClient.value) ? 'Mode vue client actif.' : 'Mode vue commercial actif',
            type: 'info'
        };
        $scope.alerts.push(alert);

        // nettoyage de la liste des popin
        $timeout(function (){
            $scope.alerts.splice($scope.alerts.indexOf(alert), 1);
        }, 5000);
    };

    // Gestion de l'ouverture de la popup Commentaires
    $scope.openPopupCommentaire = function () {
        var modalInstance = $modal.open(
            {
                scope: $scope,
                templateUrl: 'views/modal_commentaire.html',
                controller: 'ModalCommentaireCtrl',
                backdrop: 'static'
            }
        );
    };

    // Gestion de l'ouverture de la popup Aide Utilisateur
    $scope.openPopupHelp = function () {
        var modalInstance = $modal.open(
            {
                scope: $scope,
                templateUrl: 'views/modal_help.html',
                controller: 'ModalHelpCtrl',
                backdrop: 'static'
            }
        );
    };

    // Gestion de la selection de l'établissement via popup
    $scope.setEtablissementAsSelected = function (code) {
        elasticService.get_one_etablissement(code, function (etablissement) {
            $scope.etablissement.selected = etablissement;
            $scope.selectEtablissement(false);
            $scope.circle_chalandise = undefined;
        });
    };

    // Recalcul des points et layers au mouvement
    map.on('dragend', refreshMap);
    map.on('zoomend', refreshMap);
    // map.on('autopanstart', function () {
    //     // Ajoute temporisation pour compenser le temps de repositionnement de la carte
    //     // (calcul des nouvelle coordonnées des limites de l'écran)
    //     $timeout(refreshMap, 2000);
    // });
    //map.on('moveend', refreshMap);

});

// Controller pour la popup Commentaires
appGeoPro.controller('ModalCommentaireCtrl', function ($scope, $modalInstance, $timeout, elasticService) {
    $scope.user = {
        nom: undefined,
        prenom: undefined,
        fonction: undefined,
        commentaire: undefined
    };
    $scope.comment_result = {
        message: undefined,
        status: undefined
    };
    $scope.send = function () {
        elasticService.write_new_comment($scope.user, function (result, error) {
            if (result) {
                $scope.comment_result.message = '<span class="glyphicon glyphicon-ok-sign"></span> Commentaire enregistré';
                $scope.comment_result.status = 'success';
                $timeout(function (){
                    $modalInstance.close();
                    delete $scope.comment_result.status;
                    delete $scope.comment_result.message;
                }, 5000);
            } else {
                $scope.comment_result.message = '<span class="glyphicon glyphicon-remove-sign"></span>' + error;
                $scope.comment_result.status = 'error';
            }
        });
    };
    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
        if ($scope.status) {
            delete $scope.status;
        }
    };
});

// Controller pour la popup Aide Utilisateur
appGeoPro.controller('ModalHelpCtrl', function ($scope, $modalInstance) {
    $scope.close = function () {
        $modalInstance.close();
    };
});