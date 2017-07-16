import { xmlFiles, outDir } from "./config";import * as parseString from 'xml2js';
import * as  readTextFile from 'read-text-file';
import * as  _ from "lodash";
import * as  writeFile from 'write';
import * as  d3Format from 'd3-format';
import * as  d3Dsv from 'd3-dsv';
import * as  fs from "fs";
import * as request from 'request';



const formatter3 = d3Format.format('.3f')
const formatter1 = d3Format.format('.1f')
 

interface ItemPresupuesto {
    codPartida: string;
    codCapitulo: string;
    codPrograma: string;
    partida: string;
    capitulo: string;
    programa: string;
    asigna: string;
    codInstit: string;
    item: string;
    moneda: string;
    montoDolar: string;
    montoPesos: string;
    nombre: string;
    nSecuencial: string;
    numGlosa: string;
    tipoMov: string;
    periodo: number;
} 


class PresupuestoAnual {
    pptoCabecera;
    pptoCuerpo;
    itemsPresupuesto: ItemPresupuesto[];
    itemsCodigosInstituciones;
    diccionarioInstituciones;
    periodo: number;

    constructor(xml) {
        parseString.parseString(xml, (err, result) => {
            this.pptoCabecera = result.matriz.cabecera;
            this.pptoCuerpo = result.matriz.cuerpo;
        });

        this.processCuerpo();
        this.itemsCodigosInstituciones = this.processCabecera();
        this.diccionarioInstituciones = this.buildDiccionarioPartidaCapituloPrograma(this.itemsCodigosInstituciones)
        this.periodo = this.buscarPerido();
        this.addNombresYAño();
    }

    processCuerpo() {
        this.itemsPresupuesto = _.map(this.pptoCuerpo, (d) => {
            
            return <ItemPresupuesto> {
                codPartida: d['CodInstit'][0].substring(0,2),
                codCapitulo: null,
                codPrograma: null,
                
                partida: null,
                capitulo: null,
                programa: null,

                asigna : d['asigna'][0],
                codInstit : d['CodInstit'][0],
                item : d['item'][0],
                moneda : d['Moneda'][0],
                montoDolar : d['monto_dolar'][0],
                montoPesos : d['monto_pesos'][0],
                nombreNuevo : d['nombre_nuevo'][0].trim(),
                nSecuencial : d['Nsecuencial'][0],
                numGlosa : d['Num_Glosa'][0],
                subti : d['subti[0]'],
                tipoMov : d['t_tipo_mov[0]'],
                periodo : null,
                nombre: null
            }

        });
    }

    /**
     * Cada item de la cabecera incluye el periodo
     * 
     * Vamos a verificar que exista sólo uno y lo almacenamos, de lo contrario retornamos el valor -9999
     * 
     * @memberof PresupuestoAnual
     */
    buscarPerido() {
        const periodos = new Set();

        let periodo = null; // Default

        _.each(this.itemsCodigosInstituciones, (d) => {
            periodos.add(d.periodo)
        })

        if (periodos.size === 1) {
            periodo = +periodos.values().next().value;
        }

        return periodo;

    }

    processCabecera() {
        // console.dir(result);
        const itemsCodigos = _.map(this.pptoCabecera, (d) => {
            const nombre = d['nombre'][0].trim();
            const periodo = d['periodo'][0];
            const partida = d['partida'][0];
            const capitulo = d['capitulo'][0];
            const programa = d['programa'][0];
            const glosa_Programa = d['glosa_Programa'][0];
            const moneda = d['moneda[0]'];

            const record = {
                nombre: nombre,               
                periodo: periodo,              
                partida: partida,              
                capitulo: capitulo,            
                programa: programa,             
                glosa_Programa: glosa_Programa,       
                moneda: moneda               
            }
            return record;
        })

        return itemsCodigos;
    }

    buildDiccionarioPartidaCapituloPrograma(itemsCodigosInstituciones) {
        const diccionario = {};

        // Agrupamos los códigos por partida
        const partidas = _.groupBy(itemsCodigosInstituciones, (d:ItemPresupuesto) => {
            return d.partida;
        })

        _.each(partidas, (items, partida) => {

            // Agrupamos los items de cada partida por capítulo
            const capitulos = _.groupBy(items, (d) => {
                return d.capitulo;
            });

            _.each(capitulos, (items2, capitulo) => {

                // Agrupamos los items de cada caspitulo por programas
                const programas = _.groupBy(items2, (d) => {
                    return d.programa;
                })

                _.each(programas, (items3, programa) => {

                    // Si el item tiene capitulo 00 & programa 00, el nombre corresponde a la partida
                    // Si el item tiene programa 00, el nombre corresponde al capitulo
                    // En si capitulo & programa tienen valores, el nombre corresponde al programa
                    _.each(items3, (d) => {
                        // Partida
                        if (capitulo == '00' && programa == '00') {
                            diccionario[partida] = diccionario[partida] || {nombre:'', capitulos:{}};
                            diccionario[partida].nombre = d.nombre;
                            
                        // Capitulo
                        } else if (programa == '00') {
                            diccionario[partida] = diccionario[partida] || {nombre:'', capitulos:{}};
                            diccionario[partida].capitulos[capitulo] = diccionario[partida].capitulos[capitulo] || {nombre:'', programas: {}}
                            diccionario[partida].capitulos[capitulo].nombre = d.nombre
                        
                        // Programa
                        } else {
                            diccionario[partida] = diccionario[partida] || {nombre:'', capitulos:{}};
                            diccionario[partida].capitulos[capitulo] = diccionario[partida].capitulos[capitulo] || {nombre:'', programas: {}}
                            diccionario[partida].capitulos[capitulo].programas[programa] = 
                            diccionario[partida].capitulos[capitulo].programas[programa] || {nombre:''}
                            diccionario[partida].capitulos[capitulo].programas[programa].nombre = d.nombre

                        }
                        //console.log(d.partida, d.capitulo, d.programa, d.nombre);
                    })
                })

            })

        })   
        
        return diccionario;
    }

    addNombresYAño() {

        const itemsPpto = _.groupBy(this.itemsPresupuesto, (d) => {
            return d.codInstit;
        })

        _.each(itemsPpto , (items, codInstit) => {
            const codPartida= codInstit.substring(0,2);
            const codCapitulo= codInstit.substring(2,4);
            const codPrograma= codInstit.substring(4,6);

            const partida = this.diccionarioInstituciones[codPartida];
            const capitulo = partida.capitulos[codCapitulo];
            const programa = capitulo.programas[codPrograma];

            _.each(items, (d) => {
                d.codPartida = codPartida;
                d.codCapitulo = codCapitulo;
                d.codPrograma = codPrograma;            
                
                d.partida = partida.nombre;
                d.capitulo = capitulo.nombre;
                d.programa = programa.nombre;   
                
                d.periodo = this.periodo;
            })
        })
    }

    tsvFormatted() {
        return d3Dsv.tsvFormat(this.itemsPresupuesto);
    }
}

class PresupuestoHistorico {
    records: ItemPresupuesto[] = [];
    dictionary: DiccionarioProgramas;

    constructor() {

    }

    addTSV(tsv) {
        let newrecords: any[] = <any[]> d3Dsv.tsvParse(tsv);
        this.records = this.records.concat(newrecords);
    }

    tsvFormatted() {
        let tsv = d3Dsv.tsvFormat(this.records);
        return tsv;
    }

    normaliseNames() {
        const maxPeriod = _.maxBy(this.records, (d:ItemPresupuesto) => d.periodo).periodo;
        const itemsMaxPeriod = _.filter(this.records, (d) => d.periodo == maxPeriod);

        this.dictionary = new DiccionarioProgramas();
        this.dictionary.buildDictionary(itemsMaxPeriod);

        _.each(this.records, (d,i) => {
            console.log('normalise', Math.floor(100*i/this.records.length));
            d.partida = this.dictionary.getPartida({codPartida : d.codPartida}) ? this.dictionary.getPartida({codPartida : d.codPartida}) : d.partida;
            d.capitulo = this.dictionary.getCapitulo({codPartida : d.codPartida, codCapitulo: d.codCapitulo}) ? this.dictionary.getCapitulo({codPartida : d.codPartida, codCapitulo: d.codCapitulo}) : d.capitulo;
            d.programa = this.dictionary.getPrograma({codPartida : d.codPartida, codCapitulo: d.codCapitulo, codPrograma: d.codPrograma}) ? this.dictionary.getPrograma({codPartida : d.codPartida, codCapitulo: d.codCapitulo, codPrograma: d.codPrograma}) : d.programa;
        })
    }
}

class DiccionarioProgramas {
    dictionary = {}

    constructor() {

    }

    buildDictionary(items) {
        const itemsByPartida = _.groupBy(items, (d: ItemPresupuesto) => d.codPartida);

        _.each(itemsByPartida, (itemsCapitulo:ItemPresupuesto[], codPartida) => {
            this.dictionary[codPartida] = this.dictionary[codPartida] || { nombre:_.first(itemsCapitulo).partida, capitulos: {}};

            const itemsByCapitulo = _.groupBy(itemsCapitulo, (d) => d.codCapitulo)
            _.each(itemsByCapitulo, (itemsPrograma:ItemPresupuesto[],codCapitulo)  => {
                this.dictionary[codPartida].capitulos[codCapitulo] = this.dictionary[codPartida].capitulos[codCapitulo] || { nombre:_.first(itemsPrograma).capitulo, programas: {}};

                const itemsByPrograma = _.groupBy(itemsPrograma, (d) => d.codPrograma);
                _.each(itemsByPrograma, (itemsAsignacion:ItemPresupuesto[], codPrograma) => {
                    this.dictionary[codPartida].capitulos[codCapitulo].programas[codPrograma] = this.dictionary[codPartida].capitulos[codCapitulo].programas[codPrograma] || { nombre:_.first(itemsAsignacion).programa};
                })
            });
        })
    }

    getPartida(options:{codPartida:string}) {
        return this.dictionary[options.codPartida] && this.dictionary[options.codPartida].nombre;
    }    
    
    getCapitulo(options:{codPartida:string, codCapitulo:string}) {
        return this.dictionary[options.codPartida] && this.dictionary[options.codPartida].capitulos[options.codCapitulo] && this.dictionary[options.codPartida].capitulos[options.codCapitulo].nombre;
    }    

    getPrograma(options:{codPartida:string, codCapitulo:string, codPrograma:string}) {
        return this.dictionary[options.codPartida] && this.dictionary[options.codPartida].capitulos[options.codCapitulo]  && this.dictionary[options.codPartida].capitulos[options.codCapitulo].programas[options.codPrograma] && this.dictionary[options.codPartida].capitulos[options.codCapitulo].programas[options.codPrograma].nombre;
    }


}

const presupuestoHistorico = new PresupuestoHistorico()

let presupuestoAllYears = '';
_.each(xmlFiles, (d,i) => {
    console.log(d.periodo);

    const xml = readTextFile.readSync(d.url);
    let presupuesto = new PresupuestoAnual(xml);    
    let presupuestoTsv = presupuesto.tsvFormatted();
    fs.writeFile(
        `${outDir}/presupuesto_${d.periodo}.txt`,
        presupuestoTsv,
        function (err) { console.log(err ? 'Error :'+err : `ok ${d.periodo}.txt`) }
    );
    presupuestoHistorico.addTSV(presupuestoTsv);
});

presupuestoHistorico.normaliseNames();
fs.writeFile(
    `${outDir}/presupuesto_allYears.txt`,
    presupuestoHistorico.tsvFormatted(),
    function (err) { console.log(err ? 'Error :'+err : `ok AllYears.txt`) }
);

