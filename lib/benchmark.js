import { performance } from "node:perf_hooks";
import { setFlagsFromString } from "node:v8";
import ansi from "#lib/ansi";
import collectGarbage from "#lib/devel/collect-garbage";
import Locale from "#lib/locale";
import Table from "#lib/text/table";

let nativesSyntaxWasAllowedBefore;

try {
    new Function( "%GetOptimizationStatus( 0 )" );

    nativesSyntaxWasAllowedBefore = true;
}
catch {
    nativesSyntaxWasAllowedBefore = false;
}

if ( !nativesSyntaxWasAllowedBefore ) {
    setFlagsFromString( "--allow-natives-syntax" );
}

const getOptimizationStatus = new Function( "fn", "return %GetOptimizationStatus( fn );" );

if ( !nativesSyntaxWasAllowedBefore ) {
    setFlagsFromString( "--no-allow-natives-syntax" );
}

const BLACKHOLE_GUARD = Symbol( "benchmark-blackhole-guard" ),
    OPTIMIZATION_STATUS_BITS = {
        "optimized": 0x10,
        "maybeDeopted": 0x8,
    };

// public
export default async function benchmark ( title, tests, { maxTotalTime = 5000, regressionTimeFraction = 0.7, confidence = 0.95 } = {} ) {
    collectGarbage();

    tests = normalizeTests( tests );

    const createdTests = [];

    for ( const { name, test } of tests ) {
        createdTests.push( await createTest( name, test, { confidence } ) );
    }

    tests = createdTests;

    collectGarbage();

    const startTime = performance.now(),
        regressionDeadline = startTime + maxTotalTime * regressionTimeFraction,
        samplingDeadline = startTime + maxTotalTime;

    let pending = tests.slice();

    while ( pending.length > 0 && performance.now() < regressionDeadline ) {
        const stillPending = [];

        for ( const test of pending ) {
            if ( test.isRegressionDone() ) continue;

            await test.stepRegression();

            stillPending.push( test );
        }

        pending = stillPending;
    }

    pending = tests.slice();

    while ( pending.length > 0 && performance.now() < samplingDeadline ) {
        const stillPending = [];

        for ( const test of pending ) {
            if ( test.isSamplingDone() ) continue;

            await test.stepSampling();

            stillPending.push( test );
        }

        pending = stillPending;
    }

    const results = tests.map( test => test.finalize() );

    // Только тесты с валидным iterationsPerSecond участвуют в диапазоне —
    // null означает "regression не набрала данных за maxTotalTime", и
    // такую запись нельзя ни считать минимумом/максимумом, ни примешивать
    // к формуле процентиля (null арифметически приводится к 0, что даёт
    // бессмысленный отрицательный процент вместо явного "нет данных")
    const validSpeeds = results.map( test => test.iterationsPerSecond ).filter( value => value !== null );

    const speedRange = validSpeeds.length > 0
        ? [ Math.min( ...validSpeeds ), Math.max( ...validSpeeds ) ]
        : [ null, null ];

    for ( const test of results ) {
        if ( test.iterationsPerSecond === null ) {
            test.speedX = null;
        }
        else if ( speedRange[ 0 ] === speedRange[ 1 ] ) {
            test.speedX = 1;
        }
        else if ( test.iterationsPerSecond === speedRange[ 0 ] ) {
            test.slowest = true;
            test.speedX = 1;
        }
        else if ( test.iterationsPerSecond === speedRange[ 1 ] ) {
            test.fastest = true;
            test.speedX = test.iterationsPerSecond / speedRange[ 0 ];
        }
        else {
            test.speedX = test.iterationsPerSecond / speedRange[ 0 ];
        }
    }

    printReport( title, results );

    return results;
}

// private
function printReport ( title, results ) {
    console.log( `Benchmark: ${ title }` );

    const table = new Table( {
        "columns": {
            "iterationsPerSecond": {
                "title": ansi.hl( "Speed (iter./sec.)" ),
                "width": 25,
                "headerAlign": "center",
                "align": "end",
                "format": ( value, row ) => {
                    if ( value === null ) return ansi.error( " N/A " );

                    // iterationsPerSecond уже посчитан как 1000 / mean, то
                    // есть уже "вызовов в секунду" — умножение на 1000 здесь
                    // раздувало бы отображаемое число в 1000 раз
                    value = " " + Locale.default.formatNumber( value, "minimumFractionDigits:3" ) + " ";

                    if ( row.fastest ) {
                        value = ansi.ok( value );
                    }
                    else if ( row.slowest ) {
                        value = ansi.error( value );
                    }

                    return value;
                },
            },
            "speedX": {
                "title": ansi.hl( "Speed (x)" ),
                "width": 15,
                "headerAlign": "center",
                "align": "end",
                "format": ( value, row ) => {
                    if ( value === null ) {
                        value = ansi.error( " N/A " );
                    }
                    else {
                        value = " " + Locale.default.formatNumber( value, "minimumFractionDigits:1,maximumFractionDigits:1" ) + "x ";

                        if ( row.fastest ) {
                            value = ansi.ok( value );
                        }
                        else if ( row.slowest ) {
                            value = ansi.error( value );
                        }
                    }

                    return value;
                },
            },
            "name": {
                "title": ansi.hl( "Name" ),
                "margin": [ 1, 1 ],
                "headerAlign": "center",
                "align": "left",
            },
        },
    } ).pipe( process.stdout );

    table.write( results );

    table.end();
}

function normalizeTests ( tests ) {
    if ( typeof tests === "function" ) {
        return [
            {
                "name": tests.name || "test",
                "test": tests,
            },
        ];
    }
    else if ( Array.isArray( tests ) ) {
        return tests.map( ( entry, index ) => {
            return typeof entry === "function"
                ? {
                    "name": entry.name || `test${ index }`,
                    "test": entry,
                }
                : entry;
        } );
    }
    else {
        return Object.entries( tests ).map( ( [ name, test ] ) => {
            return {
                name,
                test,
            };
        } );
    }
}

async function createTest ( name, test, options ) {
    const {
        minWarmupIterations = 50,
        maxWarmupIterations = 10_000,
        warmupWindowSize = 20,
        warmupStabilityThreshold = 0.05, // ±5% между соседними окнами
        warmupStableWindowsRequired = 3,
        minBatchTime = 2, // ms, минимальная длительность одной пачки при калибровке
        maxBatchSize = 100_000,
        regressionPointsPerBatchSize = 100,

        // Широкий разброс множителей даёт больший разброс x (batchSize),
        // что напрямую снижает дисперсию оценки наклона регрессии —
        // узкий диапазон (например 0.5–2×) тонет в джиттере таймера
        regressionBatchMultipliers = [ 1, 2, 4, 8 ],
        rawSamples = 500,
        confidence = 0.95,
        bootstrapSamples = 500,
    } = options;

    let sink;

    // Пробный вызов до начала warmup: смотрим на результат первого вызова
    // fn(), и если это thenable (Promise или совместимый объект) — весь
    // дальнейший тест переключается на await на каждом вызове. Тест либо
    // целиком синхронный, либо целиком асинхронный — эта проверка
    // выполняется один раз и не переоценивается на каждом вызове, чтобы не
    // платить оверхед на "а вдруг на этот раз по-другому" при каждой
    // итерации synchronous-пути
    let probeValue;

    try {
        probeValue = test();
    }
    catch ( e ) {
        throw new Error( `benchmark[${ name }]: fn() threw during probe: ${ e.message }`, { "cause": e } );
    }

    const isAsync = probeValue !== null && typeof probeValue === "object" && typeof probeValue.then === "function";

    if ( isAsync ) {
        try {
            sink = await probeValue;
        }
        catch ( e ) {
            throw new Error( `benchmark[${ name }]: fn() rejected during probe: ${ e.message }`, { "cause": e } );
        }
    }
    else {
        sink = probeValue;
    }

    // Два отдельных пути вместо одного универсального с условным await:
    // await добавляет minimum один tick микрозадачи даже когда ждать
    // нечего, а для synchronous-теста это лишний шум прямо внутри
    // измеряемого времени. Ветвление здесь платит один раз при создании
    // теста, а не на каждый вызов fn()
    const runBatch = isAsync
        ? async ( count, phase ) => {
            try {
                for ( let i = 0; i < count; i++ ) {
                    sink = await test();
                }
            }
            catch ( e ) {
                throw new Error( `benchmark[${ name }]: fn() threw during ${ phase }: ${ e.message }`, { "cause": e } );
            }
        }
        : ( count, phase ) => {
            try {
                for ( let i = 0; i < count; i++ ) {
                    sink = test();
                }
            }
            catch ( e ) {
                throw new Error( `benchmark[${ name }]: fn() threw during ${ phase }: ${ e.message }`, { "cause": e } );
            }
        };

    // Прогрев выполняется сразу и целиком — до начала чередующихся
    // измерений, чтобы JIT успел стабилизировать код каждого теста
    // независимо от порядка их последующего чередования между собой
    let previousWindowMean = null,
        stableWindows = 0,
        totalWarmupIterations = 0;

    while ( totalWarmupIterations < maxWarmupIterations ) {
        const windowStart = performance.now();

        if ( isAsync ) {
            await runBatch( warmupWindowSize, "warmup" );
        }
        else {
            runBatch( warmupWindowSize, "warmup" );
        }

        const windowMean = ( performance.now() - windowStart ) / warmupWindowSize;

        totalWarmupIterations += warmupWindowSize;

        if ( totalWarmupIterations < minWarmupIterations ) {
            previousWindowMean = windowMean;
            continue;
        }

        if ( previousWindowMean !== null && previousWindowMean > 0 ) {
            const relativeChange = Math.abs( windowMean - previousWindowMean ) / previousWindowMean;

            stableWindows = relativeChange <= warmupStabilityThreshold
                ? stableWindows + 1
                : 0;
        }

        previousWindowMean = windowMean;

        if ( stableWindows >= warmupStableWindowsRequired ) break;
    }

    const warmupMeanTime = previousWindowMean ?? 0;

    // Снимок статуса сразу после warmup — точка отсчёта "функция уже
    // оптимизирована V8 (или нет)" перед началом измерений
    const optimizationStatusAfterWarmup = getOptimizationStatus( test );

    const baseBatchSize = Math.min( maxBatchSize, warmupMeanTime > 0
        ? Math.max( 1, Math.ceil( minBatchTime / warmupMeanTime ) )
        : 1000 );

    // Расписание размеров пачки для регрессии: несколько разных batchSize
    // вокруг базового, чтобы по прямой time = overhead + perCall × batchSize
    // отделить накладные расходы цикла/таймера от реальной стоимости fn()
    const batchSizeSchedule = regressionBatchMultipliers.map( multiplier => Math.min( maxBatchSize, Math.max( 1, Math.round( baseBatchSize * multiplier ) ) ) );

    const regressionPoints = [],
        rawTimes = [];

    let regressionScheduleIndex = 0,
        regressionSamplesDone = 0,
        rawSamplesDone = 0;

    const regressionTarget = regressionPointsPerBatchSize * batchSizeSchedule.length;

    return {
        name,
        "warmupIterations": totalWarmupIterations,
        "batchSize": baseBatchSize,

        isRegressionDone () {
            return regressionSamplesDone >= regressionTarget;
        },

        // Один шаг регрессионного измерения — один батч на одном из
        // размеров пачки из расписания (round-robin по расписанию)
        async stepRegression () {
            const batchSize = batchSizeSchedule[ regressionScheduleIndex ];

            regressionScheduleIndex = ( regressionScheduleIndex + 1 ) % batchSizeSchedule.length;

            const start = performance.now();

            if ( isAsync ) {
                await runBatch( batchSize, "measurement" );
            }
            else {
                runBatch( batchSize, "measurement" );
            }

            const totalTime = performance.now() - start;

            regressionPoints.push( { "x": batchSize, "y": totalTime } );
            regressionSamplesDone++;
        },

        isSamplingDone () {
            return rawSamplesDone >= rawSamples;
        },

        // Один необатченный вызов — честная латентность отдельного вызова
        // для перцентилей, с наносекундным таймером вместо performance.now()
        async stepSampling () {
            const start = process.hrtime.bigint();

            try {
                sink = isAsync
                    ? await test()
                    : test();
            }
            catch ( e ) {
                throw new Error( `benchmark[${ name }]: fn() threw during sampling: ${ e.message }`, { "cause": e } );
            }

            const elapsedNs = process.hrtime.bigint() - start;

            rawTimes.push( Number( elapsedNs ) / 1_000_000 );
            rawSamplesDone++;
        },

        finalize () {
            const hasRegressionData = regressionPoints.length >= 2;

            const { slope, intercept } = hasRegressionData
                ? linearRegression( regressionPoints )
                : { "slope": null, "intercept": null };

            const { lower, upper } = hasRegressionData
                ? bootstrapSlopeCi( regressionPoints, { confidence, "samples": bootstrapSamples } )
                : { "lower": null, "upper": null };

            const margin = lower !== null && upper !== null
                ? ( upper - lower ) / 2
                : null;

            const relativeError = slope !== null && slope > 0 && margin !== null
                ? margin / slope
                : null;

            const sortedRaw = [ ...rawTimes ].sort( ( a, b ) => a - b ),
                { mildOutliers, severeOutliers } = tukeyFences( sortedRaw );

            // Недостижимое условие держит sink "используемым", чтобы
            // движок не выбросил вызовы fn() как мёртвый код
            if ( sink === BLACKHOLE_GUARD ) {
                console.log( "benchmark blackhole:", sink );
            }

            // Снимок статуса после regression- и sampling-фаз — сравниваем
            // с optimizationStatusAfterWarmup, чтобы отличить "функция была
            // не оптимизирована с самого начала" от "деоптимизировалась в
            // процессе измерения" (последнее искажает mean сильнее всего,
            // потому что часть точек регрессии тогда снята с baseline/
            // interpreted-версии функции, а часть — с TurboFan-версии)
            const optimizationStatusFinal = getOptimizationStatus( test ),
                wasOptimized = ( optimizationStatusAfterWarmup & OPTIMIZATION_STATUS_BITS.optimized ) !== 0,
                isDeoptimizedNow = ( optimizationStatusFinal & OPTIMIZATION_STATUS_BITS.maybeDeopted ) !== 0,
                possibleDeopt = wasOptimized && isDeoptimizedNow;

            return {
                name,
                "complete": regressionSamplesDone >= regressionTarget && rawSamplesDone >= rawSamples,
                "async": isAsync,
                "batchSize": baseBatchSize,
                "warmupIterations": totalWarmupIterations,
                "regressionPoints": regressionPoints.length,
                "overhead": intercept,
                "mean": slope,
                margin,
                relativeError,
                "iterationsPerSecond": slope !== null && slope > 0
                    ? 1000 / slope
                    : null,
                "rawSamples": sortedRaw.length,
                "median": percentileOf( sortedRaw, 0.5 ),
                "p95": percentileOf( sortedRaw, 0.95 ),
                "p99": percentileOf( sortedRaw, 0.99 ),
                mildOutliers,
                severeOutliers,
                possibleDeopt,
            };
        },
    };
}

function linearRegression ( points ) {
    const n = points.length;

    let sumx = 0,
        sumy = 0,
        sumxy = 0,
        sumxx = 0;

    for ( const { x, y } of points ) {
        sumx += x;
        sumy += y;
        sumxy += x * y;
        sumxx += x * x;
    }

    const denominator = n * sumxx - sumx * sumx;

    if ( denominator === 0 ) {
        return { "slope": sumy / sumx, "intercept": 0 };
    }

    const slope = ( n * sumxy - sumx * sumy ) / denominator,
        intercept = ( sumy - slope * sumx ) / n;

    return {
        slope,
        intercept,
    };
}

function bootstrapSlopeCi ( points, { samples = 500, confidence = 0.95 } = {} ) {
    const n = points.length,
        slopes = new Array( samples );

    for ( let i = 0; i < samples; i++ ) {
        const resample = new Array( n );

        for ( let j = 0; j < n; j++ ) {
            resample[ j ] = points[ Math.floor( Math.random() * n ) ];
        }

        slopes[ i ] = linearRegression( resample ).slope;
    }

    slopes.sort( ( a, b ) => a - b );

    const alpha = 1 - confidence,
        lowerIndex = Math.floor( ( alpha / 2 ) * samples ),
        upperIndex = Math.min( samples - 1, Math.ceil( ( 1 - alpha / 2 ) * samples ) );

    return {
        "lower": slopes[ lowerIndex ],
        "upper": slopes[ upperIndex ],
    };
}

function percentileOf ( sortedValues, p ) {
    if ( sortedValues.length === 0 ) return null;

    const index = Math.min( sortedValues.length - 1, Math.floor( p * sortedValues.length ) );

    return sortedValues[ index ];
}

function tukeyFences ( sortedValues ) {
    if ( sortedValues.length < 4 ) {
        return {
            "mildOutliers": 0,
            "severeOutliers": 0,
        };
    }
    else {
        const q1 = percentileOf( sortedValues, 0.25 ),
            q3 = percentileOf( sortedValues, 0.75 ),
            iqr = q3 - q1,
            mildLower = q1 - 1.5 * iqr,
            mildUpper = q3 + 1.5 * iqr,
            severeLower = q1 - 3 * iqr,
            severeUpper = q3 + 3 * iqr;

        let mildOutliers = 0,
            severeOutliers = 0;

        for ( const value of sortedValues ) {
            if ( value < severeLower || value > severeUpper ) {
                severeOutliers++;
            }
            else if ( value < mildLower || value > mildUpper ) {
                mildOutliers++;
            }
        }

        return {
            mildOutliers,
            severeOutliers,
        };
    }
}
