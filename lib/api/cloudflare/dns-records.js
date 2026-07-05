export default Super =>
    class extends ( Super || class {} ) {

        // https://developers.cloudflare.com/api/operations/dns-records-for-a-zone-list-dns-records
        async getDnsRecords ( zoneId ) {
            return this._doRequest( "GET", `zones/${ zoneId }/dns_records` );
        }

        // https://developers.cloudflare.com/api/operations/dns-records-for-a-zone-create-dns-record
        async createDnsRecord ( zoneId, data ) {
            return this._doRequest( "POST", `zones/${ zoneId }/dns_records`, null, data );
        }

        // https://developers.cloudflare.com/api/operations/dns-records-for-a-zone-delete-dns-record
        async deleteDnsRecord ( zoneId, recordId ) {
            return this._doRequest( "DELETE", `zones/${ zoneId }/dns_records/${ recordId }` );
        }
    };
