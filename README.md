Sieve Analytics
=====================================

Produce basic website analytics from server or CDN request logs.

Sieve is a tool for compiling basic website analytics from server request logs
rather than using front-end libraries and third-party services.
It has two parts: an application for computing the metrics, and
a basic web server for viewing the metrics.

When we say "basic", we really mean it!
The initial metrics are:
- _Visitors_ based on IP address,
- _Referrals_ based on the `Referer` HTTP header, and
- _Top Pages_ based on the `uri-stem` (i.e., path) of the HTTP request.

Screenshot of the displayed analytics:
![](/images/screenshot-1.png)


Background and Motivation
----------

Google Analytics (GA) is too complex for me to understand.
It's overkill for all of my basic websites.
Additionally, there are general privacy concerns with GA.

For static content websites,
I just want to know which pages are popular and who is referring traffic.
Sieve does this by compiling server request logs into basic metrics.

Who produces the server request logs?
In my case, it's [AWS CloudFront](https://aws.amazon.com/cloudfront/),
but the approach that Sieve takes should be adaptable to any log format.
I host my static files on [AWS S3](https://aws.amazon.com/s3/) and 
then front the site with CloudFront.
CloudFront writes logs for each request that it receives, and
then forwards the request to the S3 bucket to fetch the resource.
(In my case, I turn off CloudFront caching, but
that _shouldn't_ impact the completeness of the CloudFront request logs.)

**So, if you have an S3 site that is fronted by CloudFront, and
the CloudFront distribution has access logs enabled,
you can use Sieve right out of the box!**

Installation
-----

1. Download and install [Bun](https://bun.sh/).
2. Install the [AWS CLI](https://aws.amazon.com/cli/).
3. Download or clone the Sieve Git repository.
4. No build step is required - Bun executes TypeScript files directly!


Usage
-----

The basic usage is to periodically synchronize (i.e., download)
your CloudFront server request logs from S3 to your local machine, and
then compute the metrics from the logs.
After that, you can view the metrics in your web browser.

#### Computing Analytics

To compute analytics, you need a few pieces of information:

```bash
$ ./compute.sh <S3-bucket+path> <local-logs-dir> <outfile.json>
```

Description:
- `S3-bucket+path` - the S3 bucket name where your CloudFront logs are written,
followed by the S3 path prefix that your specific CloudFront distribution uses.

- `local-logs-dir` - the local directory where your CloudFront logs will be copied.
By default, Sieve only syncs the most recent 3 months of logs from CloudFront.

- `outfile.json` - the JSON file that Sieve will create with the computed analytics.
Generally, you should specify a path that writes this file to `web/data/`
so that it will be automatically updated for the server.

Here's an example command line you might use for a website named `my-site.com`:

```bash
$ ./compute.sh my-logs-bucket/cloudfront-logs/my-site/ data/my-site/ web/data/my-site.json
```

Note that you can save that command into a file named `run-my-site.sh` in the repository,
and the `.gitignore` file will exclude it.
This allows you to have multiple `run-X.sh` files for each website that you track.

#### Installing a Site

The server loads the `index.html` page which fetches the file at `web/data/sites.json`.
This file is ignored in Git so you can add your own `my-site.json` file (computed from above).
The format of this file is very basic:
```json
{
  "sites": [
    {"id": "my-site", "name": "My Special Site"},
    {"id": "other-site", "name": "My Other Site"}
  ]
}
```

The `id` field must match the filename (ignoring filetype suffix) of your computed .json file.
You only need to add your site entry to this file once and
as long as future computations of your data update the same file,
then the server will serve the latest version.

#### Viewing Analytics

To view the computed analytics for any sites with a `.json` file in `web/data/`,
run the static server with:
```bash
$ ./server.sh
```
and
then navigate to `http://localhost:8080/`.

You should see a Visitors graph and other metrics.
You can toggle between your sites with the dropdown at the top left.


Discussion
------

As mentioned already, these metrics are _basic_.
Furthermore, there are some issues, including:

1. Visitors are only identified by IP address,
but multiple users behind a NAT will share the same IP address.

2. Support for excluding certain traffic is limited to string-based IP prefixes,
and only the Google crawlerbot traffic is blocked by default.

3. The "Referrals" and "Top Pages" tables might be noisy.
For example, the site itself is usually the top referer.
Some entries in these tables should ideally be filtered out.

4. and probably many more ...


Conclusion
----

Thanks for checking it out.
