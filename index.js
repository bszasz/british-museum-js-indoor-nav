const SparqlClient = require('sparql-client-2');
const SPARQL = SparqlClient.SPARQL;
const endpointBM = 'http://collection.britishmuseum.org/sparql';
const endpointNavi = 'http://lod.nik.uni-obuda.hu/marmotta/sparql/select';
const Q = require("q");

const label = 'ring';

var html_response = [];

// Get the leaderName(s) of the given city 
const queryBM =
  SPARQL`SELECT DISTINCT ?item ?room ?title
{ ?term skos:prefLabel "ring" .
  ?item crm:P2_has_type ?term .
  ?item crm:P45_consists_of ?material.
  ?material skos:prefLabel "gold" .
  ?item <http://collection.britishmuseum.org/id/ontology/PX_physical_description> ?title.
  ?item crm:P55_has_current_location ?location.
  ?location rdfs:label ?l.
  BIND (strafter(strbefore(?l, "/"),"Gallery ") AS ?label).
  BIND (URI(concat("http://example.org/rooms/", ?label)) AS ?room).
}ORDER BY ?room
`;

const clientBM = new SparqlClient(endpointBM)
  .register({ crm: 'http://erlangen-crm.org/current/' })
  .register({ skos: 'http://www.w3.org/2004/02/skos/core#' })
  .register({ rdfs: 'http://www.w3.org/2000/01/rdf-schema#' });

const clientNavi = new SparqlClient(endpointNavi)
  .register({ iloc: 'http://lod.nik.uni-obuda.hu/iloc/iloc#' })
  .register({ r: 'http://example.org/rooms/' })
  .register({ rdfs: 'http://www.w3.org/2000/01/rdf-schema#' });

var roomsToVisit = [];
var promises = [];

await clientBM.query(queryBM)
  .execute()
  .then(function (results) {
    var r;
    for (var i in results.results.bindings) {
      item = results.results.bindings[i];
      if (r != item.room.value) {
        r = item.room.value;
        console.log(item.title.value);
        roomsToVisit.push(r);

        if (roomsToVisit.length>1) {

          var queryNavi =
            `SELECT ?distance ?start ?p1 ?p2 ?p3 ?p4 ?p5 ?end ?item WHERE {
  BIND (<`+ roomsToVisit[roomsToVisit.length-2] + `> AS ?start ).
  #BIND (r:G15 AS ?end ).
  BIND (<`+ roomsToVisit[roomsToVisit.length-1] + `> AS ?end ).
  ?p1 iloc:connectsPOI ?p2.
  ?p2 iloc:connectsPOI ?p3.
  ?p3 iloc:connectsPOI ?p4.
  ?p4 iloc:connectsPOI ?p5.
  ?p1 iloc:belongsToRoom ?start.
  ?plast iloc:belongsToRoom ?end.
  FILTER (?p5 = ?plast ||?p4 = ?plast ||?p3 = ?plast || ?p2 = ?plast || ?p1 = ?plast )
  BIND ((if( ?p5 = ?plast , 5, if ( ?p4 = ?plast , 4, if( ?p3 = ?plast , 3, if( ?p2 = ?plast , 2, if( ?p1 = ?plast , 1, -1)))))) AS ?distance)
} ORDER BY ?distance LIMIT 1
`;

          //console.log(queryNavi);

		promises.push(clientNavi.query(queryNavi).execute());
        html_response.push (item.title.value);
        }
      }
    }

            Q.all(promises).done(function (results) {
            for (var r in results) {
            if (results[r].results.bindings.length > 0) {
              var item = results[r].results.bindings[0];
              var distance = item.distance.value;
              html_response.push ("Start in: " + item.start.value);
              console.log("Start in: " + item.start.value);
              for (var i = 1; i <= distance; i++) {
                html_response.push (i + ": " + item["p" + i].value);
                console.log(i + ": " + item["p" + i].value);
              }
              html_response.push ("Arrive to: " + item.end.value);
              console.log("Arrive to: " + item.end.value);
              }
             } 
            });

  })
  .catch(function (error) {
    console.dir(error);
  });

console.log (JSON.stringify(html_response));

exports.endpoint = function(req, res) {
    res.end(JSON.stringify(html_response));
}