import Range from "#lib/range";

export default class SegmentTree {
    #coordinates;
    #n;
    #tree;

    constructor ( ranges ) {
        ranges = ranges.map( range => Range.new( range ) ).filter( range => !range.isRelative );

        const coordinates = new Set();

        for ( const range of ranges ) {
            coordinates.add( range.start );
            coordinates.add( range.end );
        }

        this.#coordinates = [ ...coordinates ].sort( ( a, b ) => a - b );

        this.#n = this.#coordinates.length - 1;

        this.#tree = Array.from( { "length": 4 * this.#n }, () => [] );

        for ( const range of ranges ) {
            const qlIdx = this.#findCoordinateIndex( range.start ),
                qrIdx = this.#findCoordinateIndex( range.end );

            this.#insert( 1, 0, this.#n - 1, qlIdx, qrIdx, range );
        }
    }

    // public
    findRanges ( value ) {
        if ( value < this.#coordinates[ 0 ] || value >= this.#coordinates[ this.#n ] ) {
            return [];
        }

        let targetIdx = -1,
            left = 0,
            right = this.#n - 1;

        while ( left <= right ) {
            const middle = Math.floor( ( left + right ) / 2 );

            if ( value >= this.#coordinates[ middle ] && value < this.#coordinates[ middle + 1 ] ) {
                targetIdx = middle;

                break;
            }

            if ( value < this.#coordinates[ middle ] ) {
                right = middle - 1;
            }
            else {
                left = middle + 1;
            }
        }

        if ( targetIdx === -1 ) {
            return [];
        }
        else {
            return this.#findRanges( 1, 0, this.#n - 1, targetIdx );
        }
    }

    findIntersectingRanges ( range ) {
        const queryRange = Range.new( range );

        // Если запрос полностью за пределами дерева отрезков
        if ( queryRange.end <= this.#coordinates[ 0 ] || queryRange.start >= this.#coordinates[ this.#n ] ) {
            return [];
        }

        // Переводим физические координаты в индексы элементарных интервалов дерева
        const qlIdx = this.#findLeftIndex( queryRange.start ),
            qrIdx = this.#findRightIndex( queryRange.end );

        // Некорректный или пустой диапазон запроса
        if ( qlIdx >= qrIdx ) {
            return [];
        }

        const result = [];

        // Запускаем рекурсивный поиск пересечений в диапазоне индексов [qlIdx, qrIdx - 1]
        this.#findIntersecting( 1, 0, this.#n - 1, qlIdx, qrIdx, result );

        // Удаляем дубликаты, так как один отрезок может быть записан в нескольких узлах дерева
        return [ ...new Set( result ) ];
    }

    findCoveringRanges ( range ) {
        const queryRange = Range.new( range );

        // Если запрос выходит за границы всех известных координат,
        // его могут покрыть только те отрезки, которые изначально шире всего дерева.
        // Для корректности вычислений сузим индексы до границ дерева, но проверим условия ниже.
        const qlIdx = this.#findLeftIndex( queryRange.start ),
            qrIdx = this.#findRightIndex( queryRange.end );

        // Если искомый отрезок пустой или некорректный
        if ( qlIdx >= qrIdx ) {
            return [];
        }

        // Собираем массивы отрезков для каждого элементарного интервала [i, i+1]
        // внутри запрашиваемого диапазона
        const listsToIntersect = [];

        for ( let i = qlIdx; i < qrIdx; i++ ) {
            const currentIntervalResult = [];

            // Собираем все отрезки, которые покрывают элементарный интервал `i`
            this.#collectRangesForInterval( 1, 0, this.#n - 1, i, currentIntervalResult );

            listsToIntersect.push( currentIntervalResult );
        }

        if ( listsToIntersect.length === 0 ) return [];

        // Находим пересечение (Intersection) всех собранных списков.
        // Отрезок должен присутствовать в КАЖДОМ элементарном интервале запроса.
        let coveringRanges = listsToIntersect[ 0 ];

        for ( let i = 1; i < listsToIntersect.length; i++ ) {
            const currentSet = new Set( listsToIntersect[ i ] );

            coveringRanges = coveringRanges.filter( range => currentSet.has( range ) );
        }

        // Финальная валидация по реальным координатам
        // (на случай, если queryRange вышел за пределы крайних точек дерева отрезков)
        return coveringRanges.filter( range => range.start <= queryRange.start && range.end >= queryRange.end );
    }

    // private
    #insert ( node, left, right, qlIdx, qrIdx, range ) {
        if ( qlIdx > right || qrIdx < left || qlIdx >= qrIdx ) {
            return;
        }

        if ( left >= qlIdx && right < qrIdx ) {
            this.#tree[ node ].push( range );

            return;
        }

        const middle = Math.floor( ( left + right ) / 2 );

        if ( qlIdx <= middle ) {
            this.#insert( 2 * node, left, middle, qlIdx, qrIdx, range );
        }

        if ( qrIdx > middle + 1 ) {
            this.#insert( 2 * node + 1, middle + 1, right, qlIdx, qrIdx, range );
        }
    }

    #findRanges ( node, left, right, targetIdx, result = [] ) {
        if ( this.#tree[ node ].length > 0 ) {
            result.push( ...this.#tree[ node ] );
        }

        if ( left === right ) return result;

        const middle = Math.floor( ( left + right ) / 2 );

        if ( targetIdx <= middle ) {
            this.#findRanges( 2 * node, left, middle, targetIdx, result );
        }
        else {
            this.#findRanges( 2 * node + 1, middle + 1, right, targetIdx, result );
        }

        return result;
    }

    #findIntersecting ( node, left, right, qlIdx, qrIdx, result ) {

        // Если в текущем узле есть отрезки, они гарантированно покрывают весь узел [left, right].
        // Поскольку мы зашли в этот узел, значит узел пересекается с запросом [qlIdx, qrIdx],
        // а значит и все сохраненные здесь отрезки пересекают наш запрос.
        if ( this.#tree[ node ].length > 0 ) {
            result.push( ...this.#tree[ node ] );
        }

        // Если дошли до листа, глубже идти некуда
        if ( left === right ) return;

        const middle = Math.floor( ( left + right ) / 2 );

        // Проверяем, пересекает ли наш запрос левое поддерево [left, middle]
        // Граница левого поддерева по индексам — это middle + 1
        if ( qlIdx < middle + 1 ) {
            this.#findIntersecting( 2 * node, left, middle, qlIdx, qrIdx, result );
        }

        // Проверяем, пересекает ли наш запрос правое поддерево [middle + 1, right]
        if ( qrIdx > middle + 1 ) {
            this.#findIntersecting( 2 * node + 1, middle + 1, right, qlIdx, qrIdx, result );
        }
    }

    #collectRangesForInterval ( node, left, right, targetIdx, result ) {
        if ( this.#tree[ node ].length > 0 ) {
            result.push( ...this.#tree[ node ] );
        }

        if ( left === right ) return;

        const middle = Math.floor( ( left + right ) / 2 );

        if ( targetIdx <= middle ) {
            this.#collectRangesForInterval( 2 * node, left, middle, targetIdx, result );
        }
        else {
            this.#collectRangesForInterval( 2 * node + 1, middle + 1, right, targetIdx, result );
        }
    }

    #findCoordinateIndex ( value ) {
        var left = 0,
            right = this.#n;

        while ( left <= right ) {
            const middle = Math.floor( ( left + right ) / 2 );

            if ( this.#coordinates[ middle ] === value ) {
                return middle;
            }

            if ( this.#coordinates[ middle ] < value ) {
                left = middle + 1;
            }
            else {
                right = middle - 1;
            }
        }

        return -1;
    }

    #findLeftIndex ( value ) {
        if ( value <= this.#coordinates[ 0 ] ) return 0;
        if ( value >= this.#coordinates[ this.#n ] ) return this.#n;

        var left = 0,
            right = this.#n;

        while ( left < right ) {
            const middle = Math.floor( ( left + right ) / 2 );

            if ( this.#coordinates[ middle + 1 ] > value ) {
                right = middle;
            }
            else {
                left = middle + 1;
            }
        }

        return left;
    }

    #findRightIndex ( value ) {
        if ( value <= this.#coordinates[ 0 ] ) return 0;
        if ( value >= this.#coordinates[ this.#n ] ) return this.#n;

        var left = 0,
            right = this.#n;

        while ( left < right ) {
            const middle = Math.floor( ( left + right ) / 2 );

            if ( this.#coordinates[ middle ] >= value ) {
                right = middle;
            }
            else {
                left = middle + 1;
            }
        }

        return left;
    }
}
