import java.io.{File, FileInputStream}
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.zip.GZIPInputStream
import scala.util.Try

object SieveRead {

  val CF_LOGS_VERSION_ONE_HEADER = "#Version: 1.0"
  private val FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd")

  def readCloudFrontLogsDir(path: String): Iterator[LogSlice] = {
    val directory = new File(path)
    val files = directory.listFiles()
    val orderedFiles = files.sortBy(_.getName)

    orderedFiles.iterator.map(file => {
      val contents = readGzipFileLines(file)
      val allRequests = contents.filterNot(_.startsWith("#"))

      val requests = if (!contents.headOption.contains(CF_LOGS_VERSION_ONE_HEADER)) {
        println(s"error: file (${file.getName}) has missing or unknown header, skipping")
        Array.empty[LoggedRequest]
      } else {
        allRequests.flatMap(parseCloudFrontLoggedRequestV1)
      }

      LogSlice(file.getName, requests, allRequests.length - requests.length)
    })
  }

  def parseCloudFrontLoggedRequestV1(line: String): Option[LoggedRequest] = {
    Try {
      def clean(s: String): Option[String] = Some(s.trim).filter(_.nonEmpty).filterNot(_ == "-")

      val parts = line.split('\t')
      LoggedRequest(
        date = LocalDate.parse(parts(0), FORMATTER),
        time = parts(1),
        x_edge_location = clean(parts(2)),
        sc_bytes = clean(parts(3)).map(_.toLong),
        c_ip = clean(parts(4)),
        cs_method = parts(5),
        cs_host = parts(6),
        cs_uri_stem = parts(7),
        sc_status = parts(8).toInt,
        cs_referer = clean(parts(9)),
        cs_user_agent = clean(parts(10)),
        cs_uri_query = clean(parts(11)),
        cs_cookie = clean(parts(12)),
        x_edge_result_type = clean(parts(13)),
        x_edge_request_id = clean(parts(14)),
        x_host_header = clean(parts(15)),
        cs_protocol = clean(parts(16)),
        cs_bytes = clean(parts(17)).map(_.toLong),
        time_taken = clean(parts(18)).map(_.toDouble),
        x_forwarded_for = clean(parts(19)),
        ssl_protocol = clean(parts(20)),
        ssl_cipher = clean(parts(21)),
        x_edge_response_result_type = clean(parts(22)),
        cs_protocol_version = clean(parts(23)),
        fle_status = clean(parts(24)),
        fle_encrypted_fields = clean(parts(25)),
        c_port = clean(parts(26)).map(_.toInt),
        time_to_first_byte = clean(parts(27)).map(_.toDouble),
        x_edge_detailed_result_type = clean(parts(28)),
        sc_content_type = clean(parts(29)),
        sc_content_len = clean(parts(30)).map(_.toLong),
        sc_range_start = clean(parts(31)),
        sc_range_end = clean(parts(32))
      )
    }.toOption
  }

  // NOTE: This gunzips the whole file into memory.
  // Our hope is that CF has some reasonable max size / # of requests for a single log file.
  def readGzipFileLines(file: File): Array[String] = {
    val fileInputStream = new FileInputStream(file)
    val gzipInputStream = new GZIPInputStream(fileInputStream)
    val bytes = gzipInputStream.readAllBytes()
    new String(bytes).split('\n')
  }
}
