'use strict'

var appGeoPro = angular.module('geoproApp',[
	"ngSanitize",
	"ui.select",
	//"ngCanvasGauge",
	"frapontillo.gage",
	"ui.bootstrap-slider",
	"ngProgress",
	"ngResource",
	"ui.bootstrap",
	"ui.grid",
	"ui.grid.resizeColumns",
	"ui.grid.autoResize",
	"ui.grid.pagination",
	"ui.grid.selection",
	"ui.grid.grouping",
	"ui.grid.exporter",
	"ui.grid.pinning",
	"elasticsearch",
	"toggle-switch"
	]).constant('geoProConfig', {
		"version": "0.0.1",
		"elasticsearch": {
			"host": "http://exalead1t.bbo1t.local:10200/",
			"index": "geopro"
		},
		"algolia": {
			"algoliaClientAppId": "7TM6BC4HX4",
			"algoliaClientKey": "2b8d141963b0b2d12b7a67b79853900b",
			"indexRubriques": "INT_Rubriques",
			"indexQuiQuois": "INT_QuiQuoiPub",
			"indexOus": "INT_OuPub",
			"nbSuggestionsAffichees": 50
		}
	}
);