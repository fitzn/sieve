
import java.io.{File, FileWriter}
import java.time.LocalDate
import java.time.format.DateTimeFormatter

sealed trait SieveTask
case class MonthsTask(previous: Int) extends SieveTask
case class ComputeTask(logsDirPath: String, outputFile: String) extends SieveTask

object SieveMain extends App {
  val COMMAND_MONTHS = "months"
  val COMMAND_COMPUTE = "compute"

  val task = validateArgs(args)
  task match {
    case monthsTask: MonthsTask => runMonthsTask(monthsTask)
    case computeTask: ComputeTask => runComputeTask(computeTask)
  }

  //
  // Internal
  //

  private def runMonthsTask(task: MonthsTask): Unit = {
    val formatter = DateTimeFormatter.ofPattern("yyyy-MM-")

    val current = LocalDate.now()
    val prev = Some(task.previous).filter(_ >= 0).getOrElse(0)

    val prefixes = (0 to prev).map(months => {
      current.minusMonths(months).format(formatter)
    })

    prefixes.foreach(println)
  }

  private def runComputeTask(task: ComputeTask): Unit = {
    println(s"Computing SieveAnalytics from ${task.logsDirPath}")
    val filter = new SieveFilter(SieveFilterConfig(
      keepOnly2xx3xx = true,
      ipPrefixBlockFilePath = Some("app/resources/blocked-ip-prefixes.txt")
    ))

    val analyzer = new SieveAnalyzer(filter)

    SieveRead.readCloudFrontLogsDir(task.logsDirPath).foreach(slice => {
      if (slice.numSkipped > 0) {
        println(s"error: file (${slice.filename}) had ${slice.numSkipped} skipped lines")
      }

      // Feed them into the analyzer.
      slice.requests.foreach(analyzer.ingest)
    })

    println("Finished ingestion; computing analytics.")

    val analytics = analyzer.compute()
    val writer = new FileWriter(new File(task.outputFile))
    writer.write(analytics.toJson)
    writer.close()

    println(s"Analytics written to ${task.outputFile}")
  }

  private def validateArgs(strings: Array[String]): SieveTask = {
    val command = args.headOption
    command match {
      case Some(COMMAND_MONTHS) if args.length >= 2 => MonthsTask(args(1).toInt)
      case Some(COMMAND_COMPUTE) if args.length >= 3 => ComputeTask(args(1), args(2))
      case _ => {
        printUsageAndExit()
        MonthsTask(0) // unreachable
      }
    }
  }

  private def printUsageAndExit(): Unit = {
    println("usage: SieveMain <command> [<args>]")
    println("commands:")
    println(s"   $COMMAND_MONTHS <count>               - print the previous <months> YEAR-MONTH prefixes")
    println(s"   $COMMAND_COMPUTE <in-dir> <out.json>  - compute analytics from <in-dir> and write to <out.json>")
    System.exit(1)
  }
}
