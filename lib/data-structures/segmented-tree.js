import Range from "#lib/range";

export default class SegmentTree {
    #coords;
    #m;
    #tree;

    constructor ( ranges ) {
        ranges = ranges.map( range => Range.new( range ) ).filter( range => !range.isRelative );

        // 1. Собираем и сортируем уникальные координаты
        const coords = [];

        for ( const range of ranges ) {
            coords.push( range.start, range.end );
        }

        this.#coords = [ ...new Set( coords ) ].sort( ( a, b ) => a - b );

        // Количество элементарных промежутков
        this.#m = this.#coords.length - 1;

        // Дерево строится по индексам промежутков от 0 до m-1
        this.#tree = Array.from( { "length": 4 * this.#m }, () => [] );

        // 2. Наполняем дерево отрезками
        for ( const range of ranges ) {
            const qlIdx = this.#findCoordIdx( range.start ),
                qrIdx = this.#findCoordIdx( range.end );

            if ( this.#m > 0 ) {
                this.insert( 1, 0, this.#m - 1, qlIdx, qrIdx, range );
            }
        }
    }

    // public
    query ( value ) {

        // Если точка вне глобальных границ всех отрезков
        if ( value < this.#coords[ 0 ] || value >= this.#coords[ this.#coords.length - 1 ] ) {
            return [];
        }

        // Ищем, в какой именно элементарный промежуток [ coords[i], coords[i+1] ) попала точка X
        let targetIdx = -1,
            left = 0,
            right = this.#coords.length - 2;

        while ( left <= right ) {
            const mid = Math.floor( ( left + right ) / 2 );

            if ( value >= this.#coords[ mid ] && value < this.#coords[ mid + 1 ] ) {
                targetIdx = mid;

                break;
            }

            if ( value < this.#coords[ mid ] ) {
                right = mid - 1;
            }
            else {
                left = mid + 1;
            }
        }

        if ( targetIdx === -1 ) {
            return [];
        }
        else {
            return this.findRanges( 1, 0, this.#m - 1, targetIdx );
        }
    }

    // Поиск всех ID отрезков, покрывающих физическую точку X
    findRanges ( node, l, r, targetIdx, result = [] ) {

        // Добавляем ID отрезков, которые покрывают весь текущий узел дерева
        if ( this.#tree[ node ].length > 0 ) {
            result.push( ...this.#tree[ node ] );
        }

        if ( l === r ) return result;

        const mid = Math.floor( ( l + r ) / 2 );

        // Спускаемся в тот промежуток, в который попал индекс точки
        if ( targetIdx <= mid ) {
            this.findRanges( 2 * node, l, mid, targetIdx, result );
        }
        else {
            this.findRanges( 2 * node + 1, mid + 1, r, targetIdx, result );
        }

        return result;
    }

    // private
    // Добавление отрезка [ql, qr) в дерево отрезков
    // qlIdx и qrIdx — это индексы в массиве coords
    insert ( node, l, r, qlIdx, qrIdx, segmentId ) {
        if ( qlIdx > r || qrIdx < l || qlIdx >= qrIdx ) return;

        // Если текущий диапазон промежутков дерева [l, r] полностью внутри нужного интервала
        if ( l >= qlIdx && r < qrIdx ) {
            this.#tree[ node ].push( segmentId );
            return;
        }

        const mid = Math.floor( ( l + r ) / 2 );

        // Пересекается с левым поддеревом промежутков [l, mid]
        if ( qlIdx <= mid ) {
            this.insert( 2 * node, l, mid, qlIdx, qrIdx, segmentId );
        }

        // Пересекается с правым поддеревом промежутков [mid + 1, r]
        if ( qrIdx > mid + 1 ) {
            this.insert( 2 * node + 1, mid + 1, r, qlIdx, qrIdx, segmentId );
        }
    }

    // Вспомогательная функция для бинарного поиска индекса в coords
    #findCoordIdx ( value ) {
        var left = 0,
            right = this.#coords.length - 1;

        while ( left <= right ) {
            const mid = Math.floor( ( left + right ) / 2 );

            if ( this.#coords[ mid ] === value ) {
                return mid;
            }

            if ( this.#coords[ mid ] < value ) {
                left = mid + 1;
            }
            else {
                right = mid - 1;
            }
        }

        return -1;
    }
}
